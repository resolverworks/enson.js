import {Profile, Record, Coin, Address, Pubkey, Chash, Node, phex_from_bytes} from '../src/index.js';

let p = new Profile();
p.setText('name');
p.setText(['a', 'b']);
p.chash = true;

console.log(p.makeGetters().map(phex_from_bytes));

let r = Record.from({
	name: 'Chonker',
	'#chash': 'https://raffy.antistupid.com', 
	'$eth': '0x51050ec063d393217B436747617aD1C2285Aeeee'.toLowerCase(),
});

console.log([...r]);

console.log(Address.from('0x51050ec063d393217B436747617aD1C2285Aeeee').toObject());

console.log(Coin.from('eth'));
console.log(Coin.from('btc'));
console.log(Coin.fromChain(2));
console.log(Coin.from(69420));

console.log(Pubkey.from({x: 1, y: 2}).toJSON());


let vitalik = Record.from({
    name: 'Vitalik',
    $eth: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
    $btc: 'bc1pcm5cz7zqmc23ml65m628vrln0fja6hnhewmncya3x6n6rq7t7rdqhgqlvc',
    avatar: 'eip155:1/erc1155:0xb32979486938aa9694bfc898f35dbed459f44424/10063',
    '#ipfs': 'k2jmtxrxbr58aa3716vvr99qallufj3qae595op83p37jod4exujup32',
    '#pubkey': {x: 1, y: 2},
    '#name': 'vitalik.eth',
});
console.log(Profile.from(vitalik));

console.log(vitalik.makeSetters({name: 'vitalik.eth'}).map(phex_from_bytes));

let edit = Record.from(vitalik);
edit.delete('$btc'); // remove
edit.set('name', 'Vitamin'); // edit
edit.set('description', 'CEO of Ethereum'); // add
console.log(edit.makeSetters({name: 'vitalik.eth', init: vitalik}).map(phex_from_bytes));

console.log(Profile.ENS());

let node = Node.root();
node.import({
	"a": {
		"b": {
			"c": {
				".": {
					"chonk": "b"
				},
				"chonk": "a"
			}
		}
	}
});
console.log(node);

//console.log(Address.from('btc', '0x000307c91ad43258578beb1eb2ac0390845faf9dd1'));

console.log(Address.from('0x57632Ba9A844af0AB7d5cdf98b0056c8d87e3A85').toObject());

const chash = Chash.fromOnion('2gzyxa5ihm7nsggfxnu52rck2vv4rvmdlkiu3zzui5du4xyclen53wid');
console.log(chash.toObject());
console.log(chash.toPhex());