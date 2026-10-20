---
slug: "electrochemistry-notes"
date: "2026-10-20"
section: "chemistry"
lang: "zh"
title: "电化学"
summary: "整理半反应与电极电势的参考约定、电池反应的热力学量，以及液接电势和唐南平衡的计算。"
draft: false
---

## 1. 半反应

任一电池反应由两个半反应组成。单个半反应的 $\Delta_\mathrm{r}G^\circ$ **没有绝对可测意义**，必须选定参考电极后才有相对值；通常以标准氢电极（SHE）为参考。

常用约定（298.15 K）：

$$
\Delta_\mathrm{f}H_\mathrm{m}^{\circ}(\mathrm{H^+,aq})=0,
\qquad
\Delta_\mathrm{f}G_\mathrm{m}^{\circ}(\mathrm{H^+,aq})=0,
\qquad
S_\mathrm{m}^{\circ}(\mathrm{H^+,aq})=0
$$

注意：第三条是**标准摩尔熵** $S^\circ$ 的约定，不是生成熵 $\Delta_\mathrm{f}S^\circ$。氢分子是元素标准态，因此

$$
\Delta_\mathrm{f}S_\mathrm{m}^{\circ}(\mathrm{H_2,g})=0,
\qquad
S_\mathrm{m}^{\circ}(\mathrm{H_2,g})=130.68\ \mathrm{J\,mol^{-1}\,K^{-1}}
$$

对于半反应：

$$
2\mathrm{H^+(aq)}+2e^-=\mathrm{H_2(g)}
$$

规定其标准电极电势在**所有温度下**均为 0：

$$
E^\circ(\mathrm{H^+/H_2})=0
$$

于是

$$
\Delta_\mathrm{r}G_\mathrm{m}^{\circ}=-2FE^\circ=0
$$

由于约定 $E^\circ$ 与温度无关：

$$
\Delta_\mathrm{r}S_\mathrm{m}^{\circ}
=nF\frac{\partial E^\circ}{\partial T}
=0
$$

再由 $\Delta_\mathrm{r}G^\circ=\Delta_\mathrm{r}H^\circ-T\Delta_\mathrm{r}S^\circ$：

$$
\Delta_\mathrm{r}H_\mathrm{m}^{\circ}=0
$$

**需要强调**：这里的 $\Delta_\mathrm{r}S_\mathrm{m}^{\circ}=0$、$\Delta_\mathrm{r}H_\mathrm{m}^{\circ}=0$ 都是**约定结果**，不是实验测得的“真实”热力学量。

又

$$
\Delta_\mathrm{r}S_\mathrm{m}^{\circ}
=S_\mathrm{m}^{\circ}(\mathrm{H_2,g})
-2S_\mathrm{m}^{\circ}(\mathrm{H^+,aq})
-2S_\mathrm{m}^{\circ}(e^-)
$$

代入 $S_\mathrm{m}^{\circ}(\mathrm{H^+,aq})=0$ 和 $\Delta_\mathrm{r}S_\mathrm{m}^{\circ}=0$，得电子的**约定标准摩尔熵**：

$$
S_\mathrm{m}^{\circ}(e^-)
=\frac{1}{2}S_\mathrm{m}^{\circ}(\mathrm{H_2,g})
=\frac{1}{2}\times130.68
=65.34\ \mathrm{J\,mol^{-1}\,K^{-1}}
$$

注意：

1. 这里的 $e^-$ 是**电极金属中（或抽象意义上）的电子**，不是水合电子 $e^-_\mathrm{aq}$。
2. 正确写法是 $\frac12S_\mathrm{m}^{\circ}(\mathrm{H_2,g})$，而不是 $\frac12\Delta_\mathrm{f}S_\mathrm{m}^{\circ}(\mathrm{H_2,g})$；后者为 0。
3. 电子的生成焓约定为 $\Delta_\mathrm{f}H_\mathrm{m}^{\circ}(e^-)=0$。
4. 若用生成熵表示，$\Delta_\mathrm{f}S_\mathrm{m}^{\circ}(\mathrm{H^+,aq})=S_\mathrm{m}^{\circ}(\mathrm{H^+})+S_\mathrm{m}^{\circ}(e^-)-\frac12S_\mathrm{m}^{\circ}(\mathrm{H_2})=0+65.34-65.34=0$，即 $\Delta_\mathrm{f}S_\mathrm{m}^{\circ}(\mathrm{H^+})=0$ 是上述约定的推论，而不是原始约定。

于是可定义半反应的标准摩尔反应吉布斯自由能：

$$
\Delta_\mathrm{r}G^\circ_m=-nFE^\circ
$$

（$E^\circ$ 为标准电极电势，也可记作 $\varphi^\circ$。）

---

## 2. 热力学性质

考虑**恒温恒压**下电池反应。约定 $W_{\text{非体积功}}$ 为**环境对系统做的非体积功**（电池放电对外做功时 $W_{\text{非体积功}}<0$）：

$$
\Delta U=Q+W_{\text{非体积功}}+W_{\text{体积功}}
$$

恒压下，若体积功仅为 $pV$ 功，则

$$
\Delta H=\Delta U+p\Delta V=Q+W_{\text{非体积功}}
$$

### a. 短路

当 $W_{\text{非体积功}}=0$：

$$
Q=\Delta_\mathrm{r}H
$$

标准态下：

$$
Q=\Delta_\mathrm{r}H^\circ
$$

### b. 可逆

恒温恒压可逆过程中，非体积功等于吉布斯自由能变化：

$$
W_{\text{非体积功}}=\Delta_\mathrm{r}G^\circ
$$

因此

$$
Q=\Delta_\mathrm{r}H^\circ-\Delta_\mathrm{r}G^\circ
$$

又因为

$$
\Delta_\mathrm{r}G^\circ
=\Delta_\mathrm{r}H^\circ-T\Delta_\mathrm{r}S^\circ
$$

所以

$$
Q=T\Delta_\mathrm{r}S^\circ
$$

若把电池**对外做的电功**记为正的 $W_{\text{电}}$，则 $W_{\text{电}}=-W_{\text{非体积功}}=-\Delta_\mathrm{r}G$，符号必须写清楚。

### c. $\Delta U$ 与 $\Delta H$ 的关系

由

$$
H=U+pV
$$

得

$$
\Delta_\mathrm{r}U=\Delta_\mathrm{r}H-\Delta(pV)
$$

对理想气体、恒温反应，且凝聚相体积贡献可忽略时：

$$
\Delta_\mathrm{r}U^\circ
=\Delta_\mathrm{r}H^\circ-\Delta n_\mathrm{g}RT
$$

其中

$$
\Delta n_\mathrm{g}
=\sum\nu_{\mathrm{g}}(\text{产物})
-\sum\nu_{\mathrm{g}}(\text{反应物})
$$

对纯凝聚相反应（$\Delta n_\mathrm{g}=0$）：

$$
\Delta_\mathrm{r}U^\circ\approx\Delta_\mathrm{r}H^\circ
$$

---

## 3. 电池结构与膜电势

### 电动势与浓差电池

浓差电池（左浓、右稀，Ag/AgCl 电极）：

$$
(-)\ \mathrm{Ag(s)\,|\,AgCl(s)\,|\,Cl^-}(aq,\ 1\ \mathrm{mol\,L^{-1}})
\ ||
\ \mathrm{Cl^-}(aq,\ 0.1\ \mathrm{mol\,L^{-1}})
\ |\ \mathrm{AgCl(s)\,|\,Ag(s)}\ (+)
$$

两侧电极相同，故标准电池电动势：

$$
E^\circ_{\mathrm{cell}}=0
$$

定义**无液接电势时的电池电动势**（不要叫它 $E^\circ$）：

$$
E_{\mathrm{ideal}}
=\frac{RT}{F}\ln\frac{C_A}{C_B}
>0
\qquad(C_A>C_B)
$$

电极电势：

$$
E_L=E^\circ(\mathrm{AgCl/Ag})-\frac{RT}{F}\ln C_A
$$

$$
E_R=E^\circ(\mathrm{AgCl/Ag})-\frac{RT}{F}\ln C_B
$$

因此

$$
E_{\mathrm{ideal}}
=E_R-E_L
=\frac{RT}{F}\ln\frac{C_A}{C_B}
$$

设左右溶液内电势为 $\varphi_A,\varphi_B$，电极金属内电势为 $\varphi_L,\varphi_R$，则

$$
\varphi_L-\varphi_A
=E^\circ(\mathrm{AgCl/Ag})-\frac{RT}{F}\ln C_A
$$

$$
\varphi_R-\varphi_B
=E^\circ(\mathrm{AgCl/Ag})-\frac{RT}{F}\ln C_B
$$

总电池电动势：

$$
E=\varphi_R-\varphi_L
=\frac{RT}{F}\ln\frac{C_A}{C_B}
+(\varphi_B-\varphi_A)
=E_{\mathrm{ideal}}+(\varphi_B-\varphi_A)
$$

其中 $\varphi_B-\varphi_A$ 就是液接电势（膜电势）。理想盐桥使 $\varphi_B-\varphi_A\approx0$，故

$$
E\approx E_{\mathrm{ideal}}
$$

### 唐南平衡

平衡时，对可自由透过膜的离子：

$$
\mu_i^A=\mu_i^B
$$

即

$$
\mu_i^{\circ,A}
+RT\ln a_i^A
+z_iF\varphi_A
=
\mu_i^{\circ,B}
+RT\ln a_i^B
+z_iF\varphi_B
$$

若两侧为同种离子（$\mu_i^{\circ,A}=\mu_i^{\circ,B}$）：

$$
RT\ln\frac{a_i^A}{a_i^B}
=-z_iF(\varphi_A-\varphi_B)
$$

### 不同半透膜对电池电动势的影响

以下 $C_A$ 为浓侧、$C_B$ 为稀侧，$E_{\mathrm{ideal}}=\dfrac{RT}{F}\ln\dfrac{C_A}{C_B}$。

#### a. 无膜或理想盐桥（消除液接电势）

$$
\varphi_B-\varphi_A=0
\qquad\Rightarrow\qquad
E=E_{\mathrm{ideal}}
$$

#### b. 阳离子交换膜（仅阳离子可透过，$z=+1$）

由唐南平衡：

$$
RT\ln\frac{C_A}{C_B}
=-F(\varphi_A-\varphi_B)
$$

即

$$
\varphi_B-\varphi_A
=\frac{RT}{F}\ln\frac{C_A}{C_B}
=E_{\mathrm{ideal}}
$$

因此

$$
E=E_{\mathrm{ideal}}+(\varphi_B-\varphi_A)
=2E_{\mathrm{ideal}}
=\frac{2RT}{F}\ln\frac{C_A}{C_B}
$$

#### c. 阴离子交换膜（仅阴离子可透过，$z=-1$）

由唐南平衡：

$$
RT\ln\frac{C_A}{C_B}
=F(\varphi_A-\varphi_B)
$$

即

$$
\varphi_B-\varphi_A
=-\frac{RT}{F}\ln\frac{C_A}{C_B}
=-E_{\mathrm{ideal}}
$$

因此

$$
E=E_{\mathrm{ideal}}+(\varphi_B-\varphi_A)
=0
$$

等价地，对**阴离子可逆电极**（如 Ag/AgCl）的浓差电池，有迁移时的电动势一般式为：

$$
E=\frac{2RT}{F}t_+\ln\frac{C_A}{C_B}
$$

- 阳离子交换膜：$t_+=1$，$E=2E_{\mathrm{ideal}}$；
- 阴离子交换膜：$t_+=0$，$E=0$；
- 理想盐桥（无液接）：$E=E_{\mathrm{ideal}}$。

若电极为阳离子可逆电极，则上式中的 $t_+$ 应换为 $t_-$。

---

## 4. 盐桥

### 基本特点

1. 浓度高；
2. 正、负离子的迁移数（或扩散速率）**接近相等**，即 $t_+\approx t_-$（如 KCl、KNO₃、NH₄NO₃）。

### Nernst–Planck 方程

$$
J_i
=-D_i\frac{\mathrm{d}c_i}{\mathrm{d}x}
-\frac{z_iF}{RT}D_ic_i\frac{\mathrm{d}\varphi}{\mathrm{d}x}
$$

液接区中，零电流且电中性条件下，对 1:1 电解质有 $J_+=J_-$：

$$
-D_+\frac{\mathrm{d}c}{\mathrm{d}x}
-\frac{z_+F}{RT}D_+c\frac{\mathrm{d}\varphi}{\mathrm{d}x}
=
-D_-\frac{\mathrm{d}c}{\mathrm{d}x}
-\frac{z_-F}{RT}D_-c\frac{\mathrm{d}\varphi}{\mathrm{d}x}
$$

令 $z=z_+=|z_-|$（对 1:1 电解质 $z=1$），且 $z_-=-z_+$，整理得：

$$
\frac{\mathrm{d}\varphi}{\mathrm{d}x}
=
-\frac{RT}{zF}
\frac{D_+-D_-}{D_++D_-}
\frac{1}{c}\frac{\mathrm{d}c}{\mathrm{d}x}
$$

积分：

$$
\varphi_2-\varphi_1
=
-\frac{RT}{zF}
\frac{D_+-D_-}{D_++D_-}
\ln\frac{C_2}{C_1}
$$

定义迁移数：

$$
t_+=\frac{D_+}{D_++D_-},
\qquad
t_-=\frac{D_-}{D_++D_-}
$$

则

$$
\varphi_2-\varphi_1
=
-\frac{RT}{zF}(t_+-t_-)
\ln\frac{C_2}{C_1}
$$

对 1:1 电解质（$z=1$）：

$$
\varphi_2-\varphi_1
=
-\frac{RT}{F}(t_+-t_-)
\ln\frac{C_2}{C_1}
$$

### KCl 盐桥的液接电势

$\mathrm{KCl}$ 中 $\mathrm{K^+}$ 与 $\mathrm{Cl^-}$ 的迁移数**接近但不严格相等**，298 K 时约

$$
t_+\approx0.49,\qquad t_-\approx0.51
$$

故

$$
t_+-t_-\approx-0.02\neq0
$$

由上式，单个液接面的液接电势

$$
\varphi_2-\varphi_1
=
-\frac{RT}{F}(t_+-t_-)
\ln\frac{C_2}{C_1}
$$

**很小，但并非严格为零**。

理想盐桥有两个液接面。通过“高浓度 + $t_+\approx t_-$”，两个液接面的液接电势都很小并近似相互抵消，因此总液接电势可写为：

$$
E_{\text{液接}}\approx0
$$

只有 $D_+=D_-$（即 $t_+=t_-$）时，单个液接面的液接电势才严格为零。
