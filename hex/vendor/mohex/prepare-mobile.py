"""Apply storage/scheduling changes to the supplied upstream source, idempotently."""
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
header = root / 'src/mohex/MoHexPatterns.hpp'
source = root / 'src/mohex/MoHexPatterns.cpp'
h = header.read_text()
if 'm_tableSize' not in h:
    h = h.replace('    std::vector<Data*> m_table;', '    std::vector<Data*> m_table;\n    size_t m_tableSize;')
    header.write_text(h)
s = source.read_text()
if 'm_tableSize' not in s:
    s = s.replace(': m_table(2)', ': m_table(2, NULL), m_tableSize(0)')
    s = s.replace('    m_table[0] = new Data[TABLE_SIZE];\n    m_table[1] = new Data[TABLE_SIZE];', '')
    s = s.replace('TABLE_SIZE', 'm_tableSize')
    s = s.replace('static const uint64_t mask =', 'const uint64_t mask =')
    marker = '    for (size_t i = 0; i < m_tableSize; ++i)'
    offset = s.index(marker, s.index('void MoHexPatterns::ReadPatterns'))
    s = s[:offset] + '''    // All supplied patterns fit below 50% load. Keep every key and weight;
    // local tables need far fewer slots than global tables.
    delete[] m_table[0]; delete[] m_table[1];
    m_tableSize = filename.find("local") != std::string::npos ? (1 << 16) : (1 << 18);
    m_table[0] = new Data[m_tableSize];
    m_table[1] = new Data[m_tableSize];
''' + s[offset:]
    s = s.replace('m_tableSize / 4', 'm_tableSize / 2')
    offset = s.index('void MoHexPatterns::AddLocalToGlobal')
    s = s[:offset] + s[offset:].replace('i < m_tableSize', 'i < global.m_tableSize')
    source.write_text(s)
player_source = root / 'src/mohex/MoHexPlayer.cpp'
p = player_source.read_text()
if 'Reuse the existing cache when subtree reuse is disabled' not in p:
    p = p.replace('    MoHexSharedData data(m_search.FillinMapBits());', '''    // Reuse the existing cache when subtree reuse is disabled. Its old
    // entries are unreachable after Clear(), exactly as in a fresh cache.
    boost::scoped_ptr<MoHexSharedData> fresh(m_reuse_subtree
        ? new MoHexSharedData(m_search.FillinMapBits()) : NULL);
    MoHexSharedData& data = fresh.get() ? *fresh : m_search.SharedData();
    if (!fresh.get()) {
        data.stateData.Clear();
        data.treeStatistics = MoHexSharedData::TreeStatistics();
    }''')
    p = p.replace('    m_search.SetSharedData(data);', '    if (fresh.get()) m_search.SetSharedData(data);')
    player_source.write_text(p)
search_header = root / 'src/mohex/MoHexSearch.hpp'
h = search_header.read_text()
old = '    m_sharedData.reset(new MoHexSharedData(data));'
if 'Release the previous cache before copying' not in h:
    h = h.replace(old, '    // Release the previous cache before copying the new one.\n    // No search uses the previous state here; avoid a third live cache.\n    m_sharedData.reset();\n' + old)
    search_header.write_text(h)
if 'extern "C" void hex_yield' not in s:
    s = s.replace('#include "SgSystem.h"', '#include "SgSystem.h"\nextern "C" void hex_yield(double, double);')
    s = s.replace('    while (ins.good())', '    unsigned loaded = 0;\n    while (ins.good())')
    s = s.replace('        std::string line;', '        if ((++loaded % 1024) == 0) hex_yield(0, 0.5);\n        std::string line;')
    source.write_text(s)
