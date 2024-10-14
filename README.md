# enson.js

⚠️ This repo is under active development!

 `npm i @resolverworks/enson` [&check;](https://www.npmjs.com/package/@resolverworks/enson)

* see [**types**](./dist/index.d.ts) / check [examples](./test/examples/) / uses [ensdomains/**address-encoder**](https://github.com/ensdomains/address-encoder/)
* (7) core classes: [Coin](./src/Coin.js), [Address](./src/Address.js), [Chash](./src/Chash.js), [Pubkey](./src/Pubkey.js), [Record & Profile](./src/Record.js), [Node](./src/Node.js) 
* works with [resolverworks/**ezccip.js**](https://github.com/resolverworks/ezccip.js)
* used by [resolverworks/**TheOffchainGateway.js**](https://github.com/resolverworks/TheOffchainGateway.js)

### Record

```js
import {Record} from '@resolverworks/enson';

// construct KV records in human-readable notation
// minimal memory footprint, everything is string/Uint8Array 
let vitalik = Record.from({
    name: 'Vitalik',
    $eth: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    $btc: 'bc1pcm5cz7zqmc23ml65m628vrln0fja6hnhewmncya3x6n6rq7t7rdqhgqlvc',
    avatar: 'eip155:1/erc1155:0xb32979486938aa9694bfc898f35dbed459f44424/10063',
    '#ipfs': 'k2jmtxrxbr58aa3716vvr99qallufj3qae595op83p37jod4exujup32',
    '#pubkey': {x: 1, y: 2},
    '#name': 'vitalik.eth',
});

// supports all standard resolver functions
let name = vitalik.text('name'); // "Vitalik"
let addr60 = vitalik.addr(60); // Uint8Array(20)
let hash = vitalik.contenthash(); // Uint8Array(38)
let pubkey = vitalik.pubkey(); // UintArray(64)
let name = vitalik.name(); // "vitalik.eth"

// access wrapped values
vitalik.getAddress(60); // Address()
vitalik.getChash(); // Chash()
vitalik.getPubkey(); // Pubkey()

// generate calldata
let calls = vitalik.makeSetters({name: 'vitalik.eth'});

// generate calldata diff
let edit = Record.from(vitalik);
edit.delete('$btc'); // remove
edit.set('name', 'Vitamin'); // edit
edit.set('description', 'CEO of Ethereum'); // add
let calls = edit.makeSetters({name: 'vitalik.eth', init: vitalik});
```

### Profile

```js
import {Record} from '@resolverworks/enson';

let profile0 = Profile.ENS(); // default ENS profile

let profile = Profile.from(vitalik);
// Profile {
//   texts: Set(2) { 'name', 'avatar' },
//   addrs: Set(2) { 60n, 0n },
//   chash: true,
//   pubkey: true,
//   name: true,
//   addr0: false
// }
let calls = profile.makeGetters({name: 'nick.eth'}); // calldata 
let answers = ...; // do the calls using ethers or whatever 
let nick = new Record();
nick.parseCalls(calls, answers);
```

### Coin

```js
import {Coin} from '@resolverworks/enson';

// memozied coin formats
Coin.fromName('eth') === Coin.from({name: 'eth'}) === Coin.from('eth')
Coin.fromType(60)    === Coin.from({type: 60})    === Coin.from(60)
Coin.fromChain(1)    === Coin.from({chain: 1})

console.log(Coin.from('btc'));
// Coin { type: 0n, name: 'btc', title: 'Bitcoin' }
console.log(Coin.fromChain(2));
// UnnamedEVMCoin { type: 2147483650n }
console.log(Coin.from(69420));
// UnknownCoin { type: 69420n }
```

### Address
```js
import {Address} from '@resolverworks/enson';

Address.from('0x51050ec063d393217B436747617aD1C2285Aeeee');
Address.from('btc', 'bc1q9ejpfyp7fvjdq5fjx5hhrd6uzevn9gupxd98aq');
Address.from(0, '0x00142e6414903e4b24d05132352f71b75c165932a381');
```

### Chash
```js
import {Chash} from '@resolverworks/enson';

let ipfs = Chash.from('0xe301017012201687de19f1516b9e560ab8655faa678e3a023ebff43494ac06a36581aafc957e');
ipfs.bytes; // Uint8Array
ipfs.spec; // {codec: 0xE3, name: 'IPFS'}
ipfs.toHash(); // "k2jmtxrxbr58aa3716vvr99qallufj3qae595op83p37jod4exujup32"
ipfs.toURL(); // "ipfs://k2jmtxrxbr58aa3716vvr99qallufj3qae595op83p37jod4exujup32"
ipfs.toGatewayURL(); // "https://cloudflare-ipfs.com/ipfs/k2jmtxrxbr58aa3716vvr99qallufj3qae595op83p37jod4exujup32/"
ipfs.toObject() // { protocol: {codec: 227, name: 'IPFS'}, cid: {version: 1, codec: 112, hash: {codec: 18, data: [Uint8Array]}}}

let onion = Chash.fromOnion('2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid');
onion.toObject(); // {protocol: {codec: 445, name: 'Onion'}, pubkey: [Uint8Array], checksum: [Uint8Array], version: 3}
onion.toURL(); // "http://2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclenq.onion"

let json = Chash.from({nice: 'chonk'}, 'json'); // hint
json.toObject(); // {protocol: {codec: 74565, name: 'DataURL'}, mime: 'application/json', data: [Uint8Array], abbr: 'json', value: {nice: 'chonk'}}
json.toURL(); // "data:application/json;base64,eyJuaWNlIjoiY2hvbmsifQ=="

let file = Chash.from(readFileSync('chonk.mp4'), 'video/mp4');
```

### Node

```js
import {Node} from '@resolverworks/enson';

// create a registry
let node = Node.root();

// create some subdomains, store a Record in a Node (eg. a Resolver)
node.create('vitalik.eth').record = vitalik;

// import record from JSON at an existing node
// (same as .record = Record.from({...})
node.find('raffy.eth').import({
    name: 'Raffy',
    $eth: '0x51050ec063d393217B436747617aD1C2285Aeeee'
});

// import some subdomains
// "." is the parent node record and indicates that keys are subdomains
root.find('eth').import({
    '.':    { name: 'Ether',  $eth: '0x0000000000000000000000000000000000000000' }, // eth
    slobo:  { name: 'Alex',   $eth: '0x0000000000000000000000000000000000000001' }, // slobo.eth
    darian: { name: 'Darian', $eth: '0x0000000000000000000000000000000000000002' }  // darian.eth
});

root.flat() // list of nodes

// create reverse nodes
let rev = root.create('addr.reverse');
root.scan(node => {
    let eth = node.record?.getAddress(60);
    if (eth) {
        rev.create(eth.toPhex().slice(2)).record = Record.from({
            [Record.NAME]: node.name
        });	
    }
});
```
