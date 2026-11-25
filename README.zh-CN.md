# greenNet

[English](README.md)

**为 Android 提供的 Hosts 规则集，专为 [BindHosts](https://github.com/bindhosts/bindhosts) 模块生成。**

greenNet 从多个公开维护的 Hosts / DNS 规则源获取数据，经过解析、域名校验、去重、白名单过滤和规则合并，自动生成适用于 Android 系统的 Hosts 文件。

项目通过 GitHub Actions 自动构建，提供 IPv4 和 IPv4 + IPv6 两种格式，以及 Basic 和 Full 两种规则组合，方便用户根据实际需求选择。

## 功能特点

- **自动构建**：通过 GitHub Actions 自动获取上游规则并生成 Hosts 文件。
- **多源合并**：整合多个公开规则源，减少单一规则源的覆盖盲区。
- **自动去重**：合并规则时自动排除重复域名。
- **域名校验**：过滤无效域名和不支持的规则格式。
- **白名单机制**：支持自定义域名白名单，避免误拦截。
- **OPPO 广告规则**：针对 OPPO / realme / OnePlus 设备保留额外的广告屏蔽规则。
- **多版本输出**：提供 Basic、Full 两种规则组合，以及 IPv4、IPv4 + IPv6 两种格式。

## 使用方法

greenNet 生成的 Hosts 文件用于配合 Android Root 环境下的 [BindHosts](https://github.com/bindhosts/bindhosts) 模块使用。

### 1. 准备 Root 环境

设备需要具备 Root 权限，并安装兼容的 Root 管理器。

推荐使用 **[KernelSU](https://github.com/tiann/KernelSU)**。

注意：KernelSU 需要设备内核支持，不能仅通过安装 APK 获得 Root 权限。

BindHosts 同时支持 KernelSU、APatch 和 Magisk，具体兼容性以模块官方说明为准。

### 2. 安装 BindHosts 模块

前往 [BindHosts 官方仓库](https://github.com/bindhosts/bindhosts) 下载模块，并通过 Root 管理器安装。

安装完成后按照模块要求重启设备。

### 3. 添加 greenNet Hosts 源

打开 BindHosts 的 WebUI，添加自定义 Hosts 来源。

建议使用自己的 GitHub Fork 地址，避免直接依赖第三方仓库，同时方便自行修改规则和白名单。

例如：

```text
https://raw.githubusercontent.com/你的用户名/greenNet/main/hosts
```

保存后更新 Hosts，即可使用。

## Hosts 文件说明

项目提供四种输出文件：

| 文件 | 规则组合 | 地址格式 |
|---|---|---|
| `hosts` | Basic | IPv4 |
| `hosts_full` | Full | IPv4 |
| `hosts_all` | Basic | IPv4 + IPv6 |
| `hosts_full_all` | Full | IPv4 + IPv6 |

### Basic

不包含 HaGeZi 规则集，主要使用 AdRules 和 AWAvenue Ads Only。

适合希望控制规则规模、减少额外过滤规则的用户。

### Full

在 Basic 的基础上增加 HaGeZi Light。

提供更广泛的广告、跟踪器和其他恶意域名过滤覆盖。

### IPv4 / IPv4 + IPv6

- IPv4：仅生成 IPv4 屏蔽记录。
- IPv4 + IPv6：同时生成 IPv4 和 IPv6 屏蔽记录。

如果不确定设备的 IPv6 使用情况，建议先使用 IPv4 版本。

## 自定义配置

如果你 Fork 了本项目，建议先根据自己的设备和使用环境调整配置。

### 1. 白名单

项目提供 `oppo-allowlist.txt`，用于维护精确域名白名单。

如果某些域名被误拦截，可以将域名添加到该文件，每行一个域名。

例如：

```text
# Example
example.com
api.example.com
```

另外，脚本中的 `ALLOW_SUFFIX` 支持后缀匹配白名单，可以根据实际需要自行添加。

注意：

- `oppo-allowlist.txt` 中的域名采用精确匹配。
- `ALLOW_SUFFIX` 中的域名采用后缀匹配，会同时匹配其子域名。
- 白名单规则会影响最终生成的所有版本。

### 2. 强制屏蔽规则

脚本中的 `FORCE_BLOCK` 用于维护强制屏蔽域名。

当前包含部分 OPPO / realme / OnePlus 相关广告域名。

如果你的设备不属于这些品牌，或者希望调整相关规则，可以自行修改。

### 3. 规则源

所有规则源都在 `scripts/process.mjs` 中定义。

可以根据自己的需求增加、删除或替换规则源。

修改后建议先运行一次 GitHub Actions，检查构建统计和生成结果。

## 规则来源

本项目使用以下公开维护的规则：

| 来源 | 用途 | 项目地址 |
|---|---|---|
| AdRules | 广告过滤 | [Cats-Team/AdRules](https://github.com/Cats-Team/AdRules) |
| AWAvenue Ads Only | 广告过滤 | [TG-Twilight/AWAvenue-Ads-Rule](https://github.com/TG-Twilight/AWAvenue-Ads-Rule) |
| HaGeZi Light | 广告、跟踪器及恶意域名过滤（Full 版本） | [hagezi/dns-blocklists](https://github.com/hagezi/dns-blocklists) |
| FCM Hosts | Google FCM 网络连接优化 | [Mice-Tailor-Infra/fcm-hosts-next](https://github.com/Mice-Tailor-Infra/fcm-hosts-next) |
| GitHub520 | GitHub 域名连接优化 | [521xueweihan/GitHub520](https://github.com/521xueweihan/GitHub520) |

规则源由各自维护者独立维护，greenNet 仅负责获取、整理和生成 Hosts 文件。

## 注意事项

1. Hosts 规则可能导致部分网站、应用或服务无法正常访问。如果遇到异常，请尝试切换 Basic 版本，或通过白名单排除相关域名。
2. 不同设备、Android 版本和 ROM 对 Hosts 的处理可能存在差异。
3. IPv4 + IPv6 版本并不代表所有设备都需要使用 IPv6 屏蔽规则。
4. 本项目不保证所有规则均无误拦截，请根据实际使用情况选择。
5. 建议 Fork 本项目并使用自己的 Hosts 地址，以便独立维护白名单和规则配置。

## 致谢

感谢以下项目及其维护者提供的规则和工具：

- [AdRules](https://github.com/Cats-Team/AdRules)
- [AWAvenue Ads Only](https://github.com/TG-Twilight/AWAvenue-Ads-Rule)
- [HaGeZi DNS Blocklists](https://github.com/hagezi/dns-blocklists)
- [FCM Hosts](https://github.com/Mice-Tailor-Infra/fcm-hosts-next)
- [GitHub520](https://github.com/521xueweihan/GitHub520)
- [BindHosts](https://github.com/bindhosts/bindhosts)

感谢所有开源项目的贡献者和维护者。

**greenNet 是规则整合与 Hosts 生成项目，不拥有上游规则的版权。请遵循各上游项目的许可和使用条款。**
