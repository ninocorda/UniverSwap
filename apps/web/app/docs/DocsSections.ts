export type SectionConfig = {
  id: string;
  title: string;
  icon: string;
  paragraphs: string[];
  bulletGroups?: {
    title?: string;
    items: string[];
  }[];
};

export const sections: SectionConfig[] = [
  {
    id: 'overview',
    title: 'Platform Overview',
    icon: '🚀',
    paragraphs: [
      'Universwap is a unified DeFi suite that helps teams launch, scale and manage tokens while traders access deep liquidity across networks.',
      'A space-themed command center highlights progress across launches and governance milestones, letting communities coordinate growth without losing clarity or pace.',
    ],
    bulletGroups: [
      {
        title: 'What you get',
        items: [
          'Swap aggregation with advanced routing and transaction feedback.',
          'Token Factory for configuring supply, fees, automation and compliance in one place.',
          'Treasury utilities covering liquidity reserves, staking deposits and vesting programs.',
          'Launchpad for creating, promoting and managing IDO-style token sales.',
        ],
      },
    ],
  },
  {
    id: 'user-journeys',
    title: 'User Journeys at a Glance',
    icon: '🧭',
    paragraphs: [
      'Universwap is used by multiple profiles: traders, token issuers, liquidity managers and launchpad participants. Each journey is guided step-by-step inside the app.',
      'Navigation breadcrumbs, contextual hints and mission checklists adapt to the chosen persona, revealing only the tools needed for the next milestone.',
    ],
    bulletGroups: [
      {
        title: 'Key journeys',
        items: [
          'Traders open `/dex`, connect a wallet, select assets and execute optimized swaps with instant status toasts.',
          'Token teams visit `/factory/tokens` to configure branding, supply controls, fees and treasury destinations before deploying.',
          'Treasury operators manage liquidity reserves, staking feeds and vesting unlocks directly from the factory dashboard.',
          'Founders schedule token launches, defining caps, timelines and whitelist logic ahead of the sale.',
        ],
      },
    ],
  },
  {
    id: 'wallets-networks',
    title: 'Wallets & Networks',
    icon: '🌐',
    paragraphs: [
      'Wallet onboarding welcomes MetaMask, WalletConnect-compatible apps, Coinbase Wallet and hardware-friendly connectors out of the box.',
      'Projects can extend support beyond the preloaded BNB Chain duo by publishing curated RPC endpoints, explorers and token lists for each expansion network.',
    ],
    bulletGroups: [
      {
        title: 'Experience highlights',
        items: [
          'Share verifiable activity via copyable transaction hashes or pre-drafted callouts tuned to each chain.',
          'Session recovery monitors wallet health, reopening partially completed flows so teams never lose momentum.',
        ],
      },
    ],
  },
  {
    id: 'dex',
    title: 'DEX Module',
    icon: '🔄',
    paragraphs: [
      'Routing intelligence scans Universwap-compatible pools to surface competitive quotes while keeping the interface friendly to first-time DeFi users.',
      'Badges signal which liquidity and position management features are in active development so traders know exactly what is live today.',
    ],
    bulletGroups: [
      {
        title: 'Live today',
        items: [
          'Search any supported token, review price impact and confirm with a single click.',
          'Set custom slippage tolerances and deadlines to control execution risk.',
          'Follow each confirmation through real-time status cues that bundle the relevant explorer link.',
        ],
      },
      {
        title: 'On the roadmap',
        items: [
          'Full liquidity management for concentrated and fungible pools.',
          'Dashboard for open positions with fee accrual metrics and rebalance shortcuts.',
        ],
      },
    ],
  },
  {
    id: 'token-factory',
    title: 'Token Factory',
    icon: '🏭',
    paragraphs: [
      'Token Factory distills complex launch logistics into themed control panels, empowering teams to configure governance, treasury and compliance levers without code.',
      'Visual checkpoints confirm critical decisions—supply caps, fee routing, vesting cadence—before transactions proceed on-chain.',
    ],
    bulletGroups: [
      {
        title: 'Token configuration',
        items: [
          'Define name, symbol, decimals, initial supply and optional cap or mint permissions.',
          'Toggle minting, burning, pausing and other safeguards before deployment.',
          'Upload metadata such as logo URLs, project descriptions and social links.',
        ],
      },
      {
        title: 'Operational controls',
        items: [
          'Configure buy/sell fees with automatic routing to treasury, liquidity or burn wallets.',
          'Set anti-whale limits covering max transaction size, wallet balance thresholds and cooldown timers.',
          'Manage privileged roles from a single panel with revoke or renounce shortcuts.',
        ],
      },
      {
        title: 'Distribution toolkit',
        items: [
          'Withdraw liquidity reserves with audit-friendly receipts.',
          'Deposit tokens into staking vaults to seed reward programs.',
          'Create vesting schedules with release and revoke actions per beneficiary.',
          'Coordinate bridge mint/burn events when expanding to additional chains.',
        ],
      },
    ],
  },
  {
    id: 'liquidity-staking',
    title: 'Liquidity, Treasury & Staking',
    icon: '💧',
    paragraphs: [
      'Liquidity & treasury consoles surface reserve health, staking fuel levels and emission pacing in a single dashboard.',
      'Inline callouts describe the responsibilities tied to each action, ensuring operators trigger withdrawals or deposits with full context.',
    ],
    bulletGroups: [
      {
        title: 'Treasury actions',
        items: [
          'Define auto-liquidity splits to support market depth during active trading.',
          'Trigger one-click deposits into staking contracts to refresh reward pools.',
          'Track reserve balances and withdrawals with contextual status indicators.',
        ],
      },
      {
        title: 'Staking vision',
        items: [
          'Upcoming dashboards will chart APR, allocation weight and reward drift in one glance.',
          'Future harvest and compound controls will keep stakers tuned to a single workspace.',
          'Downloadable emission calendars will help governance bodies run transparent reviews.',
        ],
      },
    ],
  },
  {
    id: 'vesting-bridge',
    title: 'Vesting & Bridge Operations',
    icon: '🛡️',
    paragraphs: [
      'Vesting orchestration treats every beneficiary as a named participant, showing upcoming unlocks, cliffs and revocation safeguards.',
      'Bridge consoles coordinate supply parity when tokens traverse networks, complementing vesting timelines with cross-chain accountability.',
    ],
    bulletGroups: [
      {
        title: 'Vesting management',
        items: [
          'Schedule unlocks with precise cliffs and periods per beneficiary.',
          'Release vested amounts once unlock timestamps are reached.',
          'Revoke outstanding balances if contributors leave or milestones change.',
        ],
      },
      {
        title: 'Bridge oversight',
        items: [
          'Authorize minting or burning events tied to cross-chain migrations.',
          'Each bridge operation produces an auditable receipt with tx hash and timestamp for transparency.',
          'Encourage multi-sig approval flows for high-value transfers.',
        ],
      },
    ],
  },
  {
    id: 'launchpad',
    title: 'Launchpad Module',
    icon: '🛰️',
    paragraphs: [
      'Launchpad choreographs the full life cycle of a token sale, from pre-flight checklist to post-sale settlement reports.',
      'Investor dashboards spotlight pool stories, vesting commitments and key dates so contributors never feel in the dark.',
    ],
    bulletGroups: [
      {
        title: 'For creators',
        items: [
          'Set raise and sale tokens, soft/hard caps, contribution limits and vesting unlocks.',
          'Configure whitelists or open pools depending on your community strategy.',
          'Monitor funding progress in real time with per-wallet contribution tables.',
        ],
      },
      {
        title: 'For participants',
        items: [
          'Review pool overviews, tokenomics and compliance notes before contributing.',
          'Receive transaction confirmations and reminders when claim phases open.',
          'Claim purchased tokens or refunds directly within the Launchpad interface.',
        ],
      },
    ],
  },
  {
    id: 'roles-permissions',
    title: 'Roles & Permissions',
    icon: '🔐',
    paragraphs: [
      'Access control bays display every role as a badge, letting administrators toggle responsibilities without diving into Solidity.',
      'The activity log chronicles grants, revocations and renunciations, letting compliance squads verify stewardship in minutes.',
    ],
    bulletGroups: [
      {
        title: 'Available roles',
        items: [
          'Admin — full configuration authority and role assignment power.',
          'Minter — ability to mint additional supply when caps permit.',
          'Pauser — emergency stop for transfers during incident response.',
          'Fee, Liquidity, Bridge and Vesting managers — scoped permissions for specialized workflows.',
        ],
      },
      {
        title: 'Governance guidance',
        items: [
          'Rotate admin keys to multi-sig custody before public launch.',
          'Document which wallets hold critical roles and keep records updated.',
          'Use the “Renounce all roles” shortcut when a wallet should no longer control the token.',
        ],
      },
    ],
  },
  {
    id: 'fees-tokenomics',
    title: 'Fees & Tokenomics',
    icon: '💹',
    paragraphs: [
      'Every swap on `/dex` contributes 0.20% in protocol revenue, split 50% to treasury operations and 50% to the platform-token buyback & burn program (token TBA).',
      'Token Factory tiers denominated in BNB provide a clear upgrade path, letting issuers unlock automation and governance tooling as they grow.',
    ],
    bulletGroups: [
      {
        title: 'Token Factory tiers',
        items: [
          'Basic — 0.010 BNB · burn/pause with single-owner distribution.',
          'Advanced — 0.015 BNB · Adds caps, multi-recipient distribution and metadata.',
          'Pro — 0.025 BNB · Enable fee routing, auto-liquidity and anti-whale tools.',
          'DAO — 0.035 BNB · Adds vesting, governance voting and bridge operators.',
          'Premium — 0.040 BNB · Full suite: governance, liquidity, staking and branding.',
          'Elite — 0.100 BNB · Unlock minting alongside every premium feature.',
        ],
      },
      {
        title: 'Transparency notes',
        items: [
          'Launchpad success fees are listed as “Coming soon” until the module opens to creators.',
          'All fee destinations update in real time across the UI, keeping communities informed.',
          'Treasury and buyback wallets will be published alongside the platform token launch.',
        ],
      },
    ],
  },
  {
    id: 'security',
    title: 'Security, Auditing & Monitoring',
    icon: '🛡️',
    paragraphs: [
      'Security deck plates enforce validation on every form, highlight risk states and surface verifiable transaction receipts for instant checks.',
      'Universwap pairs best with continuous monitoring partners, reinforcing internal safeguards with external watchtowers.',
    ],
    bulletGroups: [
      {
        title: 'Protective measures',
        items: [
          'Use multi-signature wallets for treasury and admin duties.',
          'Enable real-time alerts for large transfers, fee changes or paused states.',
          'Run periodic security reviews and publish summaries to your community.',
        ],
      },
    ],
  },
  {
    id: 'roadmap',
    title: 'Roadmap & Support',
    icon: '🗺️',
    paragraphs: [
      'The product roadmap highlights forthcoming Liquidity & Positions workstations, automated bridge relays and DAO-native governance dashboards.',
      'Feedback loops with partners and community captains steer each milestone, keeping Universwap aligned with evolving market priorities.',
    ],
    bulletGroups: [
      {
        title: 'Stay connected',
        items: [
          'Track release notes via the public changelog and `/docs` updates.',
          'Join community channels to request features or report issues.',
          'Coordinate with the core team for co-marketing or integration partnerships.',
        ],
      },
    ],
  },
];
