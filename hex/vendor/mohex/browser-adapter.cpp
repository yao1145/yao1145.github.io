// LGPL-3.0-or-later. Browser ABI for the existing Benzene/MoHex 2.0 engine.
// Engine algorithms and pattern weights remain upstream implementations.
#include "SgSystem.h"
#include "SgInit.h"
#include "SgRandom.h"
#include "SgProp.h"
#include "HexProp.hpp"
#include "Decompositions.hpp"
#include "HexBoard.hpp"
#include "MoHexPlayer.hpp"
#include "SwapCheck.hpp"
#include "VCUtil.hpp"
#include "BitsetIterator.hpp"
#include <emscripten.h>
#include <memory>
#include <sstream>
#include <string>
using namespace benzene;

namespace {
void phase(const char* value) {
    EM_ASM({ if (Module.hexPhase) Module.hexPhase(UTF8ToString($0)); }, value);
    emscripten_sleep(0);
}
class BrowserPlayer : public MoHexPlayer {
public:
    using MoHexPlayer::Search;
    bool searched = false;
    HexPoint Search(const HexState& state, const Game& game, HexBoard& board,
                    const bitset_t& consider, double seconds, double& score) override {
        searched = true;
        phase("searching");
        return MoHexPlayer::Search(state, game, board, consider, seconds, score);
    }
};
std::unique_ptr<BrowserPlayer> player;
std::unique_ptr<ICEngine> ice;
VCBuilderParam parameters;
std::unique_ptr<HexBoard> rootBoard;
std::string result;
double lastYield = 0;
int playerSize = 0;
void init(int size) {
    if (player && playerSize == size) return;
    if (!ice) {
        SgInit(); SgProp::Init(); HexProp::Init(); Decompositions::Initialize();
        ice.reset(new ICEngine());
    }
    player.reset();
    rootBoard.reset(new HexBoard(size, size, *ice, parameters));
    player.reset(new BrowserPlayer());
    playerSize = size;
    player->SetReuseSubtree(false); // Each call supplies a complete board, including undo/swap.
    player->Search().SetMaxNodes(60000);
    player->Search().SetLockFree(true);
}
}

// Scheduling/progress hook only; the original UCT loop still selects every move.
extern "C" void hex_yield(double iterations, double rate) {
    const double now = emscripten_get_now();
    if (now - lastYield < 12) return;
    lastYield = now;
    EM_ASM({ if (Module.hexProgress) Module.hexProgress($0, $1); }, iterations, rate);
    emscripten_sleep(0);
}
extern "C" void hex_cancel() { SgSetUserAbort(true); }

extern "C" const char* hex_search(const char* cells, int size, int color,
                                 int level, double budgetMs, int maxGames,
                                 int seed, int swapAllowed) {
    result = "{\"error\":\"MoHex search failed\"}";
    try {
        SgSetUserAbort(false);
        emscripten_sleep(0);
        init(size);
        if (SgUserAbort()) return "{\"move\":-1}";
        phase("analyzing");
        SgRandom::SetSeed(seed > 0 ? seed : 1947);
        // Thread-state HexBoards retain a reference to these parameters. Keep
        // both the root board and its configuration alive between calls.
        HexBoard& board = *rootBoard;
        StoneBoard stones(size, size);
        Game game(stones); game.SetAllowSwap(swapAllowed != 0);
        for (int at = 0; at < size * size; ++at) if (cells[at] != '0')
            game.PlayMove(cells[at] == '1' ? BLACK : WHITE,
                          HexPointUtil::coordsToPoint(at % size, at / size));
        const HexColor turn = color == 1 ? BLACK : WHITE;
        if (swapAllowed && SwapCheck::PlaySwap(game, turn))
            return "{\"move\":-1,\"swap\":true,\"iterations\":0,\"winRate\":null,\"depth\":0}";
        board.GetPosition().SetPosition(stones);
        HexState state(stones, turn);
        const double seconds = std::max(0.005, budgetMs / 1000.0);
        player->SetMaxGames(maxGames);
        player->SetMaxTime(seconds);
        player->SetPerformPreSearch(level != 0);
        player->searched = false;
        double score = 0;
        const HexPoint move = player->GenMove(state, game, board, seconds, score);
        if (SgUserAbort()) return "{\"move\":-1}";
        int x, y; HexPointUtil::pointToCoords(move, x, y);
        if (x < 0 || x >= size || y < 0 || y >= size)
            return "{\"error\":\"MoHex returned no legal move\"}";
        std::ostringstream out;
        out << "{\"move\":" << y * size + x << ",\"swap\":false,\"winRate\":";
        if (score >= WIN_THRESHOLD) out << 1;
        else if (score <= LOSS_THRESHOLD) out << 0;
        else if (player->searched) out << std::max(0.0, std::min(1.0, score));
        else out << "null";
        out << ",\"iterations\":" << (player->searched ? player->Search().GamesPlayed() : 0)
            << ",\"depth\":" << (player->searched ? player->Search().Statistics().m_movesInTree.Mean() : 0)
            << ",\"proven\":" << (score >= WIN_THRESHOLD || score <= -WIN_THRESHOLD ? "true" : "false")
            << ",\"mustplay\":[";
        bool comma = false;
        const bitset_t mustplay = VCUtil::GetMustplay(board, turn);
        for (BitsetIterator it(mustplay); it; ++it) {
            int mx, my; HexPointUtil::pointToCoords(*it, mx, my);
            if (mx < 0 || mx >= size || my < 0 || my >= size) continue;
            if (comma) out << ',';
            out << my * size + mx; comma = true;
        }
        out << "]}"; result = out.str();
    } catch (const std::exception& error) {
        EM_ASM({ console.error('MoHex: ' + UTF8ToString($0)); }, error.what());
    } catch (...) {}
    return result.c_str();
}
