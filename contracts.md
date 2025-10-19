- **[AggregatorRouter]**
  - Dirección (BSC Testnet): `0xbe6A77f9F4b43473AEFdF57e6F60aD39495783A6`
  - Fecha despliegue: 2025-10-17
  - Script: `scripts/deployRouter.ts`

# UNIVERSWAP — Registro de Contratos Desplegados

Documento limpio y escaneable por red. Cada contrato con Dirección (hash), Explorer, Tx de despliegue, Bloque, Fecha y Notas.

> Nota: las direcciones son checksum (EIP-55) cuando se conocen. Complete los campos “—” al tener los datos.

## BNB Chain Mainnet (chainId 56)

- **[Algebra Quoter (THENA)]**
  - Dirección: `0xeA68020D6A9532EeC42D4dB0f92B83580c39b2cA`
  - Explorer: https://bscscan.com/address/0xeA68020D6A9532EeC42D4dB0f92B83580c39b2cA
  - Tx de despliegue: —
  - Bloque: —
  - Fecha: —
  - Notas: Quoter V2 en BSC

- **[Algebra Router (THENA)]**
  - Dirección: `0x327Dd3208f0bCF590A66110aCB6e5e6941A4EfA0`
  - Explorer: https://bscscan.com/address/0x327Dd3208f0bCF590A66110aCB6e5e6941A4EfA0
  - Tx de despliegue: —
  - Bloque: —
  - Fecha: —
  - Notas: Router Algebra

- **[Aggregator Router]**
  - Dirección: —
  - Explorer: —
  - Tx de despliegue: —
  - Bloque: —
  - Fecha: —
  - Notas: agregar cuando se despliegue

## BNB Chain Testnet (chainId 97)

- **[AggregatorRouter]**
  - Dirección: `0xbe6A77f9F4b43473AEFdF57e6F60aD39495783A6`
  - Explorer: https://testnet.bscscan.com/address/0xbe6A77f9F4b43473AEFdF57e6F60aD39495783A6
  - Tx de despliegue: *(completar con hash)*
  - Bloque: *(completar)*
  - Fecha: 2025-10-17
  - Notas: Router agregador multi-hop (testnet)
  - Swap demo:
    - Hash: `0x9f15954f1b6109dcb67a4ddf9efd0f35fabf50d1555b1923ced8620854a3416c`
    - Bloque: 69212754
    - Fecha: 2025-10-18 02:41:43 UTC
    - De: `0x7afa70D45bD844283337dab245a9E33f11961336`
    - Gas usado: 0.00014909 BNB (1 gwei)
    - Transferencias:
      - `0x7afa70D4…` → `0xbe6A77f9…` : 0.5 USDC
      - `0xbe6A77f9…` → `0x8a1a4C57…` : 0.5 USDC
      - `0x8a1a4C57…` → `0x7afa70D4…` : 0.0218935128977204 WBNB

- **[ID0 Factory]**
  - Dirección: `0xEddE753748032fa00DC20c54D5851f73E0F71C1D`
  - Explorer: https://testnet.bscscan.com/address/0xEddE753748032fa00DC20c54D5851f73E0F71C1D
  - Bloque: —
  - Fecha: —
  - Notas: Fábrica de IDO

- **[TokenFactory]**
  - Dirección actual (2025-10-18): `0x90b5697018ccD3bd7324d615f9c68692Ea699537`
  - Explorer: https://testnet.bscscan.com/address/0x90b5697018ccD3bd7324d615f9c68692Ea699537
  - Tx de despliegue: _pendiente_
  - Bloque: _pendiente_
  - Fecha: 2025-10-18
  - Notas: v3.2. Incluye soporte de tier Elite (id 6) y template `0x50620cACA7612b5C8792bF39E3c1c848B66D8b71`.
  - Dirección previa: `0x67DF29cD13b9747D703DC02AC4236EA1a97C8805`
  - Explorer: https://testnet.bscscan.com/address/0x67DF29cD13b9747D703DC02AC4236EA1a97C8805
  - Notas: v3.1. Redeploy junto a `TokenLocker` y `TokenVesting` (implementation → `0x45544b6555d65DFDB427fa60c7cD4C0323fddaE5`).
  - Dirección previa: `0x22DD9418dEB9fC6f45a2a6bf6440E549E3812C7f`
  - Explorer: https://testnet.bscscan.com/address/0x22DD9418dEB9fC6f45a2a6bf6440E549E3812C7f
  - Notas: v3. Clona `ERC20Template` (`implementation → 0xf0C5B84da6Dda946B69a71FfF6B39600873871eC`) para evitar límite EIP-170.
  - Dirección histórica: `0x3933235a3392c4329a7c679f8a8fd71Ed5Be1914`

- **[ERC20Template]**
  - Dirección actual (2025-10-18): `0x50620cACA7612b5C8792bF39E3c1c848B66D8b71`
  - Explorer: https://testnet.bscscan.com/address/0x50620cACA7612b5C8792bF39E3c1c848B66D8b71
  - Tx de despliegue: _pendiente_
  - Bloque: _pendiente_
  - Fecha: 2025-10-18
  - Notas: v3.2. Actualiza compatibilidad con tier Elite y mantiene hooks de locker/vesting.
  - Dirección previa: `0x45544b6555d65DFDB427fa60c7cD4C0323fddaE5`
  - Explorer: https://testnet.bscscan.com/address/0x45544b6555d65DFDB427fa60c7cD4C0323fddaE5
  - Fecha: 2025-10-11
  - Notas: v3.1. Base para clones redeploy (incluye locker/vesting hooks). 
  - Dirección previa: `0xf0C5B84da6Dda946B69a71FfF6B39600873871eC`
  - Explorer: https://testnet.bscscan.com/address/0xf0C5B84da6Dda946B69a71FfF6B39600873871eC
  - Fecha: 2025-10-11
  - Notas: v3. Base para clones del TokenFactory (incluye `renounceAllRoles()` y fixes de revoke).
  - Dirección histórica: `0xFdbA764E125dD8b03E864DF74C8FA6d2583E6A95`
  - Explorer: https://testnet.bscscan.com/address/0xFdbA764E125dD8b03E864DF74C8FA6d2583E6A95
  - Fecha: 2025-10-11
  - Notas: v2. Plantilla desplegada autónomamente (sin clones).
  - Dirección legacy: `0xaD1e76F2d6a8e71a49F5Aa831Ff57d20dA60771b`
  - Explorer: https://testnet.bscscan.com/address/0xaD1e76F2d6a8e71a49F5Aa831Ff57d20dA60771b
  - Fecha: 2025-10-07
  - Notas: v1. Plantilla usada por TokenFactory (versión legacy).

- **[TokenLocker]**
  - Dirección actual (2025-10-18): `0x12E69f4AFe0b3F342dfF223B434eAb98680e57F0`
  - Explorer: https://testnet.bscscan.com/address/0x12E69f4AFe0b3F342dfF223B434eAb98680e57F0
  - Tx de despliegue: _pendiente_
  - Bloque: _pendiente_
  - Fecha: 2025-10-18
  - Notas: Camino principal para lockers en combinación con TokenFactory v3.2.
  - Dirección previa: `0x0596E2afc5dC82E3BaeB202CB9e1a430636dB8BC`
  - Explorer: https://testnet.bscscan.com/address/0x0596E2afc5dC82E3BaeB202CB9e1a430636dB8BC
  - Fecha: 2025-10-11
  - Notas: Custodia externa para lockers de liquidez/equipo. Compatible con cualquier ERC20.

- **[TokenVesting]**
  - Dirección actual (2025-10-18): `0x68d6f6D1F34Eb2746A816f100E9EF525F4aAd466`
  - Explorer: https://testnet.bscscan.com/address/0x68d6f6D1F34Eb2746A816f100E9EF525F4aAd466
  - Tx de despliegue: _pendiente_
  - Bloque: _pendiente_
  - Fecha: 2025-10-18
  - Notas: Versión alineada con TokenFactory v3.2 para plan de vesting extendido.
  - Dirección previa: `0x75c1f4D56491491dDFBb64a949934FAf17Bb9c15`
  - Explorer: https://testnet.bscscan.com/address/0x75c1f4D56491491dDFBb64a949934FAf17Bb9c15
  - Fecha: 2025-10-11
  - Notas: Custodia y liberación programada (batch vesting) administrada por la plataforma.

- **[Algebra Router (THENA)]**
  - Dirección: —
  - Explorer: —
  - Tx de despliegue: —
{{ ... }}
  - Fecha: —
  - Notas: no configurado

---
## Cómo actualizar

- Añada un bloque por contrato con los 6 campos.
- Para nuevas versiones, duplique el bloque y añada nota “v2/v3 + fecha”.

## Verificación de TokenFactory

- **Opción automática (recomendada)**
  - Abre `apps/web/app/factory/tokens/` y desde la tarjeta `VerificationDownloads` usa **Verificar en BscScan**.
  - Introduce tu `API key` de BscScan (no se almacena) y, si quieres reproducir el despliegue exacto, pega el `deploymentTx` del TokenFactory.
  - El endpoint `/api/factory/[token]/verification` ahora asume constructor `0x` salvo que proporciones el hash de despliegue. Envía el `Standard JSON` directamente a `verifysourcecode` y realiza polling hasta obtener el resultado.
  - Revisa el registro en pantalla para cada paso. Si todo sale bien verás un toast `Verificación completada`.

- **Opción manual (fallback)**
  - Descarga `Factory Standard JSON` desde la tarjeta y verifica el TokenFactory en BscScan (constructor `0x` salvo que extraigas el real con el hash de despliegue).
  - Si necesitas el constructor real, usa el descargable `Factory Constructor Args` con el hash del despliegue para reconstruirlo.
  - Útil cuando no quieres compartir tu `API key` o si BscScan limita la llave.

## Verificación de tokens desplegados

- **Proceso**
  - Cada token generado por `TokenFactory.createToken()` es un contrato `ERC20Template` independiente.
  - Verifica cada token en BscScan usando el `Token Standard JSON` (misma compilación) y constructor `0x`.
  - No se requiere flujo de proxies ni enlace adicional.


## Frontend

- **My Tokens panel**: Nueva sección disponible en `apps/web/app/factory/tokens/` con hook `useFactoryTokens()` para listar tokens del usuario, datos de verificación y acciones (mint, burn, pause, metadata, fees, anti-whale, liquidez, staking, vesting, bridge).

## Referencias .env (actuales)

- `NEXT_PUBLIC_RPC_56=https://bsc-dataseed.binance.org`
- `NEXT_PUBLIC_RPC_97=https://data-seed-prebsc-1-s1.binance.org:8545`
- `NEXT_PUBLIC_ALGEBRA_QUOTER_56=0xeA68020D6A9532EeC42D4dB0f92B83580c39b2cA`
- `NEXT_PUBLIC_ALGEBRA_ROUTER_56=0x327Dd3208f0bCF590A66110aCB6e5e6941A4efA0`
- `NEXT_PUBLIC_IDO_FACTORY_97=0xEddE753748032fa00DC20c54D5851f73E0F71C1D`

