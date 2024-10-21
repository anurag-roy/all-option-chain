<div align="center">

# Option Chain

Live Option Chain for Equity Derivatives using Finvasia (Shoonya) APIs and Next.js

![Screenshot](https://github.com/anurag-roy/all-option-chain/assets/53750093/fb25ea44-e3cd-40e4-87a1-bf4de3a27406)

</div>

## Features

- Gainers and Losers table based on previous day's closing price
- Auto fetch and ignore banned NSE stocks for that day
- Customisable list of additional stocks to ignore from monitoring
- Tabular display of options with search, pagination and filters
  - Option
  - LTP
  - PE Limit
  - CE Limit
  - Buyer Value
  - Return Value
  - Strike Position
  - Sell Value
- Place Sell orders manually or automated
- (Bonus) Place bulk After Market Orders (AMO)

## Screenshots

![Dark Mode](https://github.com/anurag-roy/all-option-chain/assets/53750093/76a20722-200d-44f7-bf81-acbc8e1c635a)

![Place Sell order Modal](https://github.com/anurag-roy/all-option-chain/assets/53750093/8ee94dc2-05ef-425a-a7be-e30d30923af0)

![Place Sell Order Modal (Dark Mode)](https://github.com/anurag-roy/all-option-chain/assets/53750093/a802dc70-dbe6-4ba3-98c9-a4c1583c24af)

## Setup

Install dependencies.

```sh
npm install
```

Setup environment secrets in an `env.json` file by copying the `example.env.json` file. For further customisation, see [configuration](#configuration).

```sh
cd src
cp example.env.json env.json
# Populate env.json secrets
```

Generate Prisma client.

```sh
npx prisma generate
```

Populate the SQLite DB with instrument data.

```sh
npm run data:prepare
```

## Usage

Start in development mode

```
npm run dev
```

Build and start production server.

```sh
npm run build
npm start
```

## Configuration

### Port

The default port is `3000`. To change it, update the `dev` and `start` scripts in `package.json`.

### config.ts

Edit `src/config.ts` to:

- `STOCKS_TO_INCLUDE` - List of F&O stocks to be used.
- `CUSTOM_PERCENT` - Custom stock-wise entry percentages. This will override the `Entry Percent` provided as input for that particular stock.

## Wireframe

The app was developed based on this wireframe:

<img width="1412" alt="option-chain" src="https://pub-70bba02430384bcfb1ee3bbfbf3bd6d6.r2.dev/all-option-chain.jpeg">

</div>

## Related

- [Shoonya Option Chain](https://github.com/anurag-roy/shoonya-option-chain)
- [Kite Option Chain](https://github.com/anurag-roy/kite-option-chain)

## Contact

- [Twitter](https://twitter.com/anurag__roy)
- [Email](mailto:anuragroy@duck.com)

## License

[MIT © 2023 Anurag Roy](/LICENSE)
