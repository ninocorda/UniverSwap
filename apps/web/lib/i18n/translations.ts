export type Language = 'en' | 'es';

export const languages: Language[] = ['en', 'es'];

type ActionTranslation = {
  title: string;
  description: string;
  success: string;
  failure: string;
};

type TranslationMap = {
  header: {
    title: string;
    description: string;
    nav: {
      dex: string;
      factory: string;
      staking: string;
      launchpad: string;
    };
    language: {
      en: string;
      es: string;
    };
  };
  tokenCard: {
    general: {
      tier: string;
      totalSupply: string;
      cap: string;
      decimals: string;
      created: string;
      copyAddress: string;
      viewOnExplorer: string;
      featureDisabled: string;
      downloadExampleJson: string;
      notAvailable: string;
    };
    sections: {
      capabilities: string;
      primaryActions: string;
      advancedActions: string;
    };
    features: {
      cap: string;
      roles: string;
      distribution: string;
      metadata: string;
      mint: string;
      fees: string;
      autoLiquidity: string;
      antiWhale: string;
      staking: string;
      vesting: string;
      governance: string;
      bridge: string;
      branding: string;
      lock: string;
      platformVesting: string;
    };
    actions: {
      mint: ActionTranslation;
      burn: ActionTranslation;
      pause: ActionTranslation;
      unpause: ActionTranslation;
      metadata: ActionTranslation;
      fees: ActionTranslation;
      antiwhale: ActionTranslation;
      renounceAllRoles: ActionTranslation;
      liquidity: ActionTranslation;
      withdrawLiquidity: ActionTranslation;
      depositStaking: ActionTranslation;
      releaseVesting: ActionTranslation;
      revokeVesting: ActionTranslation;
      bridgeMint: ActionTranslation;
      bridgeBurn: ActionTranslation;
    };
    fields: {
      recipient: string;
      amount: string;
      amountSymbol: string;
      metadataUri: string;
      brandingUri: string;
      feeJson: string;
      feeHelper: string;
      enable: string;
      maxTx: string;
      maxWallet: string;
      cooldown: string;
      router: string;
      pairToken: string;
      bps: string;
      address: string;
      index: string;
      to: string;
      from: string;
    };
    locker: {
      title: string;
      description: string;
      amountLabel: string;
      unlockLabel: string;
      lockButton: string;
      approveButton: string;
      contractLabel: string;
      pendingTitle: string;
      loading: string;
      empty: string;
      statusLabel: string;
      withdrawButton: string;
      approvalPrompt: string;
      approvalError: string;
      invalidApprovalAmount: string;
      withdrawalSuccess: string;
      withdrawalFailure: string;
      withdrawalError: string;
      alreadyWithdrawn: string;
      notReady: string;
      lockSuccessTitle: string;
      lockFailureTitle: string;
      lockErrorFallback: string;
      entryAmount: string;
      entryUnlock: string;
    };
    statuses: {
      withdrawn: string;
      locked: string;
      available: string;
    };
    vesting: {
      title: string;
      description: string;
      beneficiaryLabel: string;
      removeRow: string;
      addressLabel: string;
      amountLabel: string;
      releaseDateLabel: string;
      addBeneficiary: string;
      createBatch: string;
      approveButton: string;
      pendingTitle: string;
      loading: string;
      empty: string;
      pendingLabel: string;
      releaseColumnLabel: string;
      funderLabel: string;
      beneficiaryLabelInline: string;
      claimButton: string;
      contractLabel: string;
      approvalPrompt: string;
      approvalError: string;
      invalidApprovalAmount: string;
      alreadyReleased: string;
      notReady: string;
      releaseSuccess: string;
      releaseFailure: string;
      releaseError: string;
      vestingSuccessTitle: string;
      vestingFailureTitle: string;
      vestingErrorFallback: string;
    };
    errors: {
      amountRequired: string;
      invalidAddress: string;
      jsonRequired: string;
      invalidJson: string;
      mustBeArray: string;
      invalidEntry: string;
      cooldownInvalid: string;
      addressInvalid: string;
      bpsOutOfRange: string;
      unlockDatetime: string;
      unlockFuture: string;
      addVestingRow: string;
      rowInvalidAddress: string;
      rowInvalidDatetime: string;
      rowUnlockFuture: string;
      transactionFailed: string;
    };
    misc: {
      approvalSubmitted: string;
      approvalFailed: string;
    };
  };
};

export const translations: Record<Language, TranslationMap> = {
  en: {
    header: {
      title: 'Universwap',
      description: 'Multichain DeFi Platform',
      nav: {
        dex: 'DEX',
        factory: 'Token Factory',
        staking: 'Staking',
        launchpad: 'Launchpad',
      },
      language: {
        en: 'EN',
        es: 'ES',
      },
    },
    tokenCard: {
      general: {
        tier: 'Tier {{tier}}',
        totalSupply: 'Total supply',
        cap: 'Cap',
        decimals: 'Decimals',
        created: 'Created',
        copyAddress: 'Copy address',
        viewOnExplorer: 'View on explorer',
        featureDisabled: 'Feature disabled',
        downloadExampleJson: 'Download example JSON',
        notAvailable: 'N/A',
      },
      sections: {
        capabilities: 'Capabilities',
        primaryActions: 'Primary actions',
        advancedActions: 'Advanced actions',
      },
      features: {
        cap: 'Supply cap enforcement',
        roles: 'Custom access-control roles',
        distribution: 'Multiple recipients & vesting',
        metadata: 'Custom metadata URI',
        mint: 'Mint new tokens on demand',
        fees: 'Dynamic fee routing',
        autoLiquidity: 'Auto-liquidity reserve',
        antiWhale: 'Anti-whale rules',
        staking: 'Staking reserve manager',
        vesting: 'Team vesting schedules',
        governance: 'ERC20Votes governance',
        bridge: 'Bridge operator roles',
        branding: 'Branding URI support',
        lock: 'Lock liquidity / team tokens',
        platformVesting: 'Platform-managed vesting lockers',
      },
      actions: {
        mint: {
          title: 'Mint',
          description: 'Mint new supply to an address.',
          success: 'Mint submitted',
          failure: 'Mint failed',
        },
        burn: {
          title: 'Burn',
          description: 'Burn tokens from your wallet.',
          success: 'Burn submitted',
          failure: 'Burn failed',
        },
        pause: {
          title: 'Pause',
          description: 'Stop transfers.',
          success: 'Pause submitted',
          failure: 'Pause failed',
        },
        unpause: {
          title: 'Unpause',
          description: 'Resume transfers.',
          success: 'Unpause submitted',
          failure: 'Unpause failed',
        },
        metadata: {
          title: 'Update metadata',
          description: 'Set metadata and branding URIs.',
          success: 'Metadata update submitted',
          failure: 'Metadata update failed',
        },
        fees: {
          title: 'Update fees',
          description: 'Replace fee split configuration.',
          success: 'Fee update submitted',
          failure: 'Fee update failed',
        },
        antiwhale: {
          title: 'Update anti-whale',
          description: 'Configure limits and cooldown.',
          success: 'Anti-whale update submitted',
          failure: 'Anti-whale update failed',
        },
        renounceAllRoles: {
          title: 'Renounce all roles',
          description: 'Give up minting, pausing, fee and admin rights for this wallet.',
          success: 'Renounce submitted',
          failure: 'Renounce failed',
        },
        liquidity: {
          title: 'Liquidity config',
          description: 'Update router, pair token and BPS.',
          success: 'Liquidity config submitted',
          failure: 'Liquidity config failed',
        },
        withdrawLiquidity: {
          title: 'Withdraw liquidity reserve',
          description: 'Transfer tokens from liquidity reserve.',
          success: 'Liquidity withdrawal submitted',
          failure: 'Liquidity withdrawal failed',
        },
        depositStaking: {
          title: 'Deposit to staking',
          description: 'Move reserve tokens to staking manager.',
          success: 'Staking deposit submitted',
          failure: 'Staking deposit failed',
        },
        releaseVesting: {
          title: 'Release vesting',
          description: 'Release vested tokens for beneficiary/index.',
          success: 'Vesting release submitted',
          failure: 'Vesting release failed',
        },
        revokeVesting: {
          title: 'Revoke vesting',
          description: 'Revoke active vesting schedule.',
          success: 'Vesting revoke submitted',
          failure: 'Vesting revoke failed',
        },
        bridgeMint: {
          title: 'Bridge mint',
          description: 'Mint for bridge operations.',
          success: 'Bridge mint submitted',
          failure: 'Bridge mint failed',
        },
        bridgeBurn: {
          title: 'Bridge burn',
          description: 'Burn tokens for bridge withdrawal.',
          success: 'Bridge burn submitted',
          failure: 'Bridge burn failed',
        },
      },
      fields: {
        recipient: 'Recipient',
        amount: 'Amount',
        amountSymbol: 'Amount ({{symbol}})',
        metadataUri: 'Metadata URI',
        brandingUri: 'Branding URI',
        feeJson: 'Fee JSON',
        feeHelper: 'Provide a JSON array of fee splits. Download the starter template below.',
        enable: 'Enable',
        maxTx: 'Max tx ({{symbol}})',
        maxWallet: 'Max wallet ({{symbol}})',
        cooldown: 'Cooldown blocks',
        router: 'Router',
        pairToken: 'Pair token',
        bps: 'BPS',
        address: 'Address',
        index: 'Index',
        to: 'Recipient',
        from: 'From',
      },
      locker: {
        title: 'Token locker',
        description: 'Hold tokens until a specific date using the platform locker contract.',
        amountLabel: 'Amount ({{symbol}})',
        unlockLabel: 'Unlock date',
        lockButton: 'Lock tokens',
        approveButton: 'Approve locker',
        contractLabel: 'Contract',
        pendingTitle: 'Your pending locks',
        loading: 'Loading…',
        empty: 'No active locks for this token.',
        statusLabel: 'Status',
        withdrawButton: 'Withdraw',
        approvalPrompt: 'Approval sent. Confirm in your wallet and retry the lock.',
        approvalError: 'Failed to approve locker contract.',
        invalidApprovalAmount: 'Enter a valid amount before approving.',
        withdrawalSuccess: 'Withdrawal submitted',
        withdrawalFailure: 'Withdrawal failed',
        withdrawalError: 'Unable to withdraw lock.',
        alreadyWithdrawn: 'This lock was already withdrawn.',
        notReady: 'Unlock time has not been reached yet.',
        lockSuccessTitle: 'Lock scheduled',
        lockFailureTitle: 'Lock failed',
        lockErrorFallback: 'Unable to lock tokens',
        entryAmount: 'Amount',
        entryUnlock: 'Unlock',
      },
      statuses: {
        withdrawn: 'Withdrawn',
        locked: 'Locked',
        available: 'Available',
      },
      vesting: {
        title: 'Platform vesting',
        description: 'Create single-release vesting batches managed by the platform contract.',
        beneficiaryLabel: 'Beneficiary #{{index}}',
        removeRow: 'Remove',
        addressLabel: 'Address',
        amountLabel: 'Amount ({{symbol}})',
        releaseDateLabel: 'Release date',
        addBeneficiary: 'Add beneficiary',
        createBatch: 'Create vesting batch',
        approveButton: 'Approve vesting',
        pendingTitle: 'Your claimable vestings',
        loading: 'Loading…',
        empty: 'No pending vestings for this token.',
        pendingLabel: 'Pending',
        releaseColumnLabel: 'Release',
        funderLabel: 'Funder',
        beneficiaryLabelInline: 'Beneficiary',
        claimButton: 'Claim',
        contractLabel: 'Contract',
        approvalPrompt: 'Approval sent. Confirm in your wallet and retry creating the batch.',
        approvalError: 'Failed to approve vesting contract.',
        invalidApprovalAmount: 'Enter valid amounts before approving.',
        alreadyReleased: 'This vesting has already been released.',
        notReady: 'Release date not reached yet.',
        releaseSuccess: 'Release submitted',
        releaseFailure: 'Release failed',
        releaseError: 'Unable to release vesting.',
        vestingSuccessTitle: 'Vesting batch submitted',
        vestingFailureTitle: 'Vesting failed',
        vestingErrorFallback: 'Unable to create vesting batch',
      },
      errors: {
        amountRequired: 'Amount is required.',
        invalidAddress: 'Invalid address.',
        jsonRequired: 'JSON is required.',
        invalidJson: 'Invalid JSON.',
        mustBeArray: 'Must be an array.',
        invalidEntry: 'Invalid entry at index {{index}}.',
        cooldownInvalid: 'Cooldown is invalid.',
        addressInvalid: 'Address is invalid.',
        bpsOutOfRange: 'BPS must be between 0 and 10,000.',
        unlockDatetime: 'Provide a valid unlock date and time.',
        unlockFuture: 'Unlock time must be in the future.',
        addVestingRow: 'Add at least one vesting row.',
        rowInvalidAddress: 'Row {{row}}: invalid address.',
        rowInvalidDatetime: 'Row {{row}}: invalid release date.',
        rowUnlockFuture: 'Row {{row}}: release must be in the future.',
        transactionFailed: 'Transaction failed',
      },
      misc: {
        approvalSubmitted: 'Approval submitted',
        approvalFailed: 'Approval failed',
      },
    },
  },
  es: {
    header: {
      title: 'Universwap',
      description: 'Plataforma DeFi multichain',
      nav: {
        dex: 'DEX',
        factory: 'Fábrica de tokens',
        staking: 'Staking',
        launchpad: 'Launchpad',
      },
      language: {
        en: 'EN',
        es: 'ES',
      },
    },
    tokenCard: {
      general: {
        tier: 'Nivel {{tier}}',
        totalSupply: 'Suministro total',
        cap: 'Tope',
        decimals: 'Decimales',
        created: 'Creado',
        copyAddress: 'Copiar dirección',
        viewOnExplorer: 'Ver en el explorador',
        featureDisabled: 'Función deshabilitada',
        downloadExampleJson: 'Descargar JSON de ejemplo',
        notAvailable: 'N/D',
      },
      sections: {
        capabilities: 'Capacidades',
        primaryActions: 'Acciones principales',
        advancedActions: 'Acciones avanzadas',
      },
      features: {
        cap: 'Control de tope de suministro',
        roles: 'Roles personalizados de acceso',
        distribution: 'Múltiples destinatarios y vesting',
        metadata: 'URI de metadata personalizada',
        mint: 'Minteo de tokens bajo demanda',
        fees: 'Ruteo dinámico de comisiones',
        autoLiquidity: 'Reserva de auto-liquidez',
        antiWhale: 'Reglas anti-ballenas',
        staking: 'Gestor de reserva de staking',
        vesting: 'Vesting para el equipo',
        governance: 'Gobernanza con ERC20Votes',
        bridge: 'Roles de operadores de bridge',
        branding: 'Soporte para URI de branding',
        lock: 'Bloqueo de liquidez / tokens del equipo',
        platformVesting: 'Vestings administrados por la plataforma',
      },
      actions: {
        mint: {
          title: 'Mintear',
          description: 'Mintea nuevo suministro a una dirección.',
          success: 'Minteo enviado',
          failure: 'Minteo falló',
        },
        burn: {
          title: 'Quemar',
          description: 'Quema tokens desde tu wallet.',
          success: 'Quema enviada',
          failure: 'Quema falló',
        },
        pause: {
          title: 'Pausar',
          description: 'Detén las transferencias.',
          success: 'Pausa enviada',
          failure: 'Pausa falló',
        },
        unpause: {
          title: 'Reanudar',
          description: 'Reanuda las transferencias.',
          success: 'Reanudación enviada',
          failure: 'Reanudación falló',
        },
        metadata: {
          title: 'Actualizar metadata',
          description: 'Configura las URIs de metadata y branding.',
          success: 'Actualización de metadata enviada',
          failure: 'Actualización de metadata falló',
        },
        fees: {
          title: 'Actualizar comisiones',
          description: 'Reemplaza la configuración de fee splits.',
          success: 'Actualización de comisiones enviada',
          failure: 'Actualización de comisiones falló',
        },
        antiwhale: {
          title: 'Actualizar anti-ballenas',
          description: 'Configura límites y cooldown.',
          success: 'Actualización anti-ballenas enviada',
          failure: 'Actualización anti-ballenas falló',
        },
        renounceAllRoles: {
          title: 'Renunciar a todos los roles',
          description: 'Entrega los permisos de minteo, pausa, comisiones y administración de esta wallet.',
          success: 'Renuncia enviada',
          failure: 'Renuncia falló',
        },
        liquidity: {
          title: 'Configurar liquidez',
          description: 'Actualiza router, token par y BPS.',
          success: 'Configuración de liquidez enviada',
          failure: 'Configuración de liquidez falló',
        },
        withdrawLiquidity: {
          title: 'Retirar reserva de liquidez',
          description: 'Transfiere tokens desde la reserva de liquidez.',
          success: 'Retiro de liquidez enviado',
          failure: 'Retiro de liquidez falló',
        },
        depositStaking: {
          title: 'Depositar a staking',
          description: 'Mueve tokens de reserva al gestor de staking.',
          success: 'Depósito a staking enviado',
          failure: 'Depósito a staking falló',
        },
        releaseVesting: {
          title: 'Liberar vesting',
          description: 'Libera tokens para beneficiario/índice.',
          success: 'Liberación de vesting enviada',
          failure: 'Liberación de vesting falló',
        },
        revokeVesting: {
          title: 'Revocar vesting',
          description: 'Revoca un vesting activo.',
          success: 'Revocación de vesting enviada',
          failure: 'Revocación de vesting falló',
        },
        bridgeMint: {
          title: 'Minteo para bridge',
          description: 'Mintea para operaciones de bridge.',
          success: 'Minteo de bridge enviado',
          failure: 'Minteo de bridge falló',
        },
        bridgeBurn: {
          title: 'Quema para bridge',
          description: 'Quema tokens para retiros de bridge.',
          success: 'Quema de bridge enviada',
          failure: 'Quema de bridge falló',
        },
      },
      fields: {
        recipient: 'Destinatario',
        amount: 'Monto',
        amountSymbol: 'Monto ({{symbol}})',
        metadataUri: 'URI de metadata',
        brandingUri: 'URI de branding',
        feeJson: 'JSON de fees',
        feeHelper: 'Proporciona un arreglo JSON de fee splits. Descarga el template inicial abajo.',
        enable: 'Activar',
        maxTx: 'Tx máxima ({{symbol}})',
        maxWallet: 'Wallet máxima ({{symbol}})',
        cooldown: 'Bloques de cooldown',
        router: 'Router',
        pairToken: 'Token par',
        bps: 'BPS',
        address: 'Dirección',
        index: 'Índice',
        to: 'Destinatario',
        from: 'Origen',
      },
      locker: {
        title: 'Locker de tokens',
        description: 'Retén tokens hasta una fecha específica usando el contrato de la plataforma.',
        amountLabel: 'Monto ({{symbol}})',
        unlockLabel: 'Fecha de desbloqueo',
        lockButton: 'Bloquear tokens',
        approveButton: 'Aprobar locker',
        contractLabel: 'Contrato',
        pendingTitle: 'Tus locks pendientes',
        loading: 'Cargando…',
        empty: 'No tienes locks activos para este token.',
        statusLabel: 'Estado',
        withdrawButton: 'Retirar',
        approvalPrompt: 'Aprobación enviada. Confirma en tu wallet y vuelve a intentar el bloqueo.',
        approvalError: 'No se pudo aprobar el contrato de locker.',
        invalidApprovalAmount: 'Ingresa un monto válido antes de aprobar.',
        withdrawalSuccess: 'Retiro enviado',
        withdrawalFailure: 'Retiro falló',
        withdrawalError: 'No se pudo retirar el lock.',
        alreadyWithdrawn: 'Este lock ya fue retirado.',
        notReady: 'Aún no llega la fecha de desbloqueo.',
        lockSuccessTitle: 'Bloqueo programado',
        lockFailureTitle: 'Bloqueo falló',
        lockErrorFallback: 'No se pudieron bloquear los tokens',
        entryAmount: 'Monto',
        entryUnlock: 'Desbloqueo',
      },
      statuses: {
        withdrawn: 'Retirado',
        locked: 'Bloqueado',
        available: 'Disponible',
      },
      vesting: {
        title: 'Vesting de plataforma',
        description: 'Crea lotes con una liberación única administrados por el contrato global.',
        beneficiaryLabel: 'Beneficiario #{{index}}',
        removeRow: 'Remover',
        addressLabel: 'Dirección',
        amountLabel: 'Monto ({{symbol}})',
        releaseDateLabel: 'Fecha de liberación',
        addBeneficiary: 'Añadir beneficiario',
        createBatch: 'Crear batch de vesting',
        approveButton: 'Aprobar vesting',
        pendingTitle: 'Vestings reclamables',
        loading: 'Cargando…',
        empty: 'No tienes vestings pendientes para este token.',
        pendingLabel: 'Pendiente',
        releaseColumnLabel: 'Liberación',
        funderLabel: 'Funder',
        beneficiaryLabelInline: 'Beneficiario',
        claimButton: 'Reclamar',
        contractLabel: 'Contrato',
        approvalPrompt: 'Aprobación enviada. Confirma en tu wallet y vuelve a crear el batch.',
        approvalError: 'No se pudo aprobar el contrato de vesting.',
        invalidApprovalAmount: 'Ingresa montos válidos antes de aprobar.',
        alreadyReleased: 'Este vesting ya fue liberado.',
        notReady: 'Aún no llega la fecha de liberación.',
        releaseSuccess: 'Liberación enviada',
        releaseFailure: 'Liberación falló',
        releaseError: 'No se pudo liberar el vesting.',
        vestingSuccessTitle: 'Batch de vesting enviado',
        vestingFailureTitle: 'Vesting falló',
        vestingErrorFallback: 'No se pudo crear el batch de vesting',
      },
      errors: {
        amountRequired: 'El monto es obligatorio.',
        invalidAddress: 'Dirección inválida.',
        jsonRequired: 'El JSON es obligatorio.',
        invalidJson: 'JSON inválido.',
        mustBeArray: 'Debe ser un arreglo.',
        invalidEntry: 'Entrada inválida en el índice {{index}}.',
        cooldownInvalid: 'El cooldown es inválido.',
        addressInvalid: 'La dirección es inválida.',
        bpsOutOfRange: 'Los BPS deben estar entre 0 y 10 000.',
        unlockDatetime: 'Ingresa una fecha y hora de desbloqueo válidas.',
        unlockFuture: 'La fecha de desbloqueo debe estar en el futuro.',
        addVestingRow: 'Añade al menos una fila de vesting.',
        rowInvalidAddress: 'Fila {{row}}: dirección inválida.',
        rowInvalidDatetime: 'Fila {{row}}: fecha de liberación inválida.',
        rowUnlockFuture: 'Fila {{row}}: la liberación debe ser en el futuro.',
        transactionFailed: 'La transacción falló',
      },
      misc: {
        approvalSubmitted: 'Aprobación enviada',
        approvalFailed: 'Aprobación falló',
      },
    },
  },
};

type NestedKey<T> = T extends object
  ? {
      [K in keyof T & string]: `${K}` | `${K}.${NestedKey<T[K]>}`;
    }[keyof T & string]
  : never;

export type TranslationKey = NestedKey<TranslationMap>;
