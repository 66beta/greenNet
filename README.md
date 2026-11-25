# GreenNet Hosts

[简体中文](README.zh-CN.md)

**Android Hosts rules generated for [BindHosts](https://github.com/bindhosts/bindhosts).**

GreenNet collects and combines publicly maintained Hosts and DNS blocklists, then processes them through domain validation, deduplication, whitelist filtering, and rule merging to generate Hosts files for Android devices.

The project uses GitHub Actions to automatically fetch upstream rules and generate four Hosts variants, allowing users to choose between different filtering levels and IP address formats.

## Features

- **Automated builds** — Automatically fetch and process upstream rules using GitHub Actions.
- **Multiple rule sources** — Combine several publicly maintained blocklists for broader coverage.
- **Domain deduplication** — Automatically remove duplicate domain entries.
- **Domain validation** — Filter invalid domains and unsupported rule formats.
- **Custom allowlists** — Exclude specific domains to prevent unwanted blocking.
- **OPPO-related rules** — Additional ad-blocking rules for OPPO, realme, and OnePlus devices.
- **Multiple output variants** — Provide Basic and Full rule sets in IPv4 and IPv4 + IPv6 formats.

## Installation and Usage

GreenNet generates Hosts files for use with the Android Root module [BindHosts](https://github.com/bindhosts/bindhosts).

### 1. Prepare a Root Environment

Your Android device must have Root access and a compatible Root manager installed.

**[KernelSU](https://github.com/tiann/KernelSU) is recommended.**

Other supported Root solutions include Magisk and APatch. Please refer to the BindHosts documentation for compatibility details.

Note: KernelSU requires a compatible kernel. Installing the KernelSU Manager APK alone does not provide Root access.

### 2. Install BindHosts

Download the latest module from the [BindHosts repository](https://github.com/bindhosts/bindhosts) and install it through your Root manager.

Follow the module's instructions and reboot your device if required.

### 3. Add a GreenNet Hosts Source

Open the BindHosts WebUI and add a custom Hosts source.

It is recommended to fork this repository and use your own GitHub raw URL. This allows you to customize allowlists and rules independently without relying on a third-party repository.

For example:

```text
https://raw.githubusercontent.com/YOUR_USERNAME/greenNet/main/hosts
```

Replace `YOUR_USERNAME` with your GitHub username.

Save the source and update Hosts through BindHosts.

## Available Hosts Files

GreenNet generates four variants:

| File | Rule Set | Address Format |
|---|---|---|
| `hosts` | Basic | IPv4 |
| `hosts_full` | Basic + HaGeZi DNS Blocklists | IPv4 |
| `hosts_all` | Basic | IPv4 + IPv6 |
| `hosts_full_all` | Basic + HaGeZi DNS Blocklists | IPv4 + IPv6 |

### Basic

Includes:

- AdRules
- AWAvenue Ads Only

HaGeZi is excluded to provide a more lightweight rule set.

Suitable for users who prefer a smaller rule set and want to avoid additional filtering rules.

### Full

Includes everything in Basic, plus:

- HaGeZi Light

Provides broader coverage for advertisements, trackers, and other unwanted domains.

### IPv4 and IPv4 + IPv6

- **IPv4**: Generates IPv4 blocking entries only.
- **IPv4 + IPv6**: Generates both IPv4 and IPv6 blocking entries.

If you are unsure whether your device requires IPv6 blocking entries, start with the IPv4 version.

## Customization

If you fork this repository, you may want to customize the configuration according to your device and usage environment.

### 1. Allowlists

The project includes `oppo-allowlist.txt` for maintaining exact-match domain allowlists.

If a legitimate domain is blocked accidentally, add it to this file, one domain per line.

Example:

```text
# Example
example.com
api.example.com
```

The script also provides `ALLOW_SUFFIX` for suffix-based allowlisting.

Important differences:

- `oppo-allowlist.txt` uses exact domain matching.
- `ALLOW_SUFFIX` matches the specified domain and all its subdomains.
- Allowlist rules apply to all four generated Hosts files.

**When forking this project, review and customize the allowlists according to your own devices and requirements.**

### 2. Forced Blocking Rules

The `FORCE_BLOCK` configuration in `scripts/process.mjs` maintains domains that are always blocked.

It currently includes additional advertising-related domains associated with OPPO, realme, and OnePlus devices.

You can modify or remove these entries according to your needs.

### 3. Upstream Rule Sources

All upstream rule sources are configured in `scripts/process.mjs`.

You can add, remove, or replace sources as needed.

After modifying the configuration, run GitHub Actions and check the build statistics and generated files.

## Rule Sources

GreenNet uses the following publicly maintained projects:

| Source | Purpose | Repository |
|---|---|---|
| AdRules | Advertisement blocking | [Cats-Team/AdRules](https://github.com/Cats-Team/AdRules) |
| AWAvenue Ads Only | Advertisement blocking | [TG-Twilight/AWAvenue-Ads-Rule](https://github.com/TG-Twilight/AWAvenue-Ads-Rule) |
| HaGeZi Light | Advertisement, tracker, and malicious domain blocking (Full variant) | [hagezi/dns-blocklists](https://github.com/hagezi/dns-blocklists) |
| FCM Hosts | Google FCM connectivity optimization | [Mice-Tailor-Infra/fcm-hosts-next](https://github.com/Mice-Tailor-Infra/fcm-hosts-next) |
| GitHub520 | GitHub connectivity optimization | [521xueweihan/GitHub520](https://github.com/521xueweihan/GitHub520) |

These rule sources are independently maintained by their respective authors.

GreenNet only retrieves, processes, and combines these rules to generate Hosts files.

## Notes

1. Hosts rules may occasionally block legitimate websites, applications, or services. If you encounter problems, try the Basic variant or add the affected domain to your allowlist.
2. Hosts handling may vary across Android versions, device manufacturers, and ROM implementations.
3. The IPv4 + IPv6 variant is not necessarily required on every device.
4. No blocklist is guaranteed to be free of false positives. Choose the appropriate variant for your environment.
5. Forking this repository and using your own Hosts URL is recommended for independent maintenance and customization.

## Acknowledgements

Special thanks to the following projects and their contributors for providing the rules and tools used by greenNet:

- [AdRules](https://github.com/Cats-Team/AdRules)
- [AWAvenue Ads Only](https://github.com/TG-Twilight/AWAvenue-Ads-Rule)
- [HaGeZi DNS Blocklists](https://github.com/hagezi/dns-blocklists)
- [FCM Hosts](https://github.com/Mice-Tailor-Infra/fcm-hosts-next)
- [GitHub520](https://github.com/521xueweihan/GitHub520)
- [BindHosts](https://github.com/bindhosts/bindhosts)

Thanks to all open-source contributors and maintainers for their work.

**GreenNet is a rule aggregation and Hosts generation project. It does not own the upstream rules. Please respect the licenses and terms of use of each upstream project.**
