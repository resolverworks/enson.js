# enson.js
ENS Object Notation
 
 `npm i @resolverworks/enson`

* see [types](./dist/index.d.ts) / check [examples](./examples/)
* (6) core classes: [Coin](./src/Coin.js), [Address](./src/Address.js), [ContentHash](./src/Record.js), [Pubkey](./src/Record.js), [Record](./src/Record.js), [Node](./src/Record.js) 
* compatible with [**resolverworks/ezccip.js**](https://github.com/adraffy/ezccip.js) `getRecord()`


### Coin

```js
import {Coin} from '@resolverworks/enson';

// memozied coin format
let ETH = Coin.fromType(60); 
let BTC = Coin.from({name: 'btc'}); 
ETH === Coin.from({name: 'eth'}) 
ETH === Coin.from({type: 60})
ETH === Coin.from({chain: 1})
```

### Address
```js
import {Address} from '@resolverworks/enson';

let eth = Address('eth', '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
eth.type; // 60
eth.name; // eth
eth.bytes; // Uint8Array
eth.toString(); // 0x...
```

### ContentHash
```js
import {ContentHash} from '@resolverworks/enson';

let ipfs = ContentHash.fromBytes('0xe301017012201687de19f1516b9e560ab8655faa678e3a023ebff43494ac06a36581aafc957e');
ipfs.bytes; // Uint8Array
ipfs.spec; // {codec: 0xE3, name: 'IPFS'}
ipfs.toHash(); // "k2jmtxrxbr58aa3716vvr99qallufj3qae595op83p37jod4exujup32"
ipfs.toURL(); // "ipfs://k2jmtxrxbr58aa3716vvr99qallufj3qae595op83p37jod4exujup32"
ipfs.toGatewayURL(); // "https://cloudflare-ipfs.com/ipfs/k2jmtxrxbr58aa3716vvr99qallufj3qae595op83p37jod4exujup32/"
ipfs.toObject() // CID {version: 1, codec: 114, hash: Multihash(...)}

let onion = ContentHash.fromOnion('2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid');
onion.toObject(); // {pubkey: Uint8Array(32), checksum: Uint8Array(2), version: 3}
onion.toURL(); // "http://2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclenq.onion"

let json = ContentHash.fromEntry('json', {nice: 'chonk'});
json.toObject(); // {json: {nice: "chonk"}}
json.toURL(); // "data:text/plain;base64,bmljZSBjaG9uaw=="

let file = ContentHash.fromEntry('video/mp4', readFileSync('chonk.mp4'));
```

### Record

```js
import {Record} from '@resolverworks/enson';

// construct KV records in human-readable notation
// minimal memory footprint, everything is string/Uint8Array 
let vitalik = Record.from({
	name: 'Vitalik',
	$eth: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
	$btc: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
	avatar: 'eip155:1/erc1155:0xb32979486938aa9694bfc898f35dbed459f44424/10063',
	'#ipfs': 'k2jmtxrxbr58aa3716vvr99qallufj3qae595op83p37jod4exujup32',
	'#pubkey': {x: 1, y: 2},
	'#name': 'vitalik.eth', // reverse name
});

// supports all standard resolver functions
let addr60 = rec.addr(60); // Uint8Array(20)
let hash = rec.contenthash(); // Uint8Array(38)

// record is just a Map()
vitalik.get('name'); // "Vitalik"
vitalik.get(60); // Address
vitalik.get(Record.CONTENTHASH); // Contenthash
```

### [Node](./src/Node.js)

```js
import {Node} from '@resolverworks/enson';

// create a registry
let node = Node.root();

// create some subdomains, store a Record in a Node (eg. a Resolver)
node.create('vitalik.raffy.eth').record = vitalik;

// import record from JSON at an existing node
node.find('raffy.eth').importJSON({
	name: 'Raffy',
	$eth: '0x51050ec063d393217B436747617aD1C2285Aeeee'
});

// import some subdomains
node.find('eth').importJSON({
	slobo: {
		name: 'Alex'
	},
});
```
