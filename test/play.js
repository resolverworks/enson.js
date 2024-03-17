import {Profile, Record, Coin, Address, Pubkey} from '../src/index.js';

let p = new Profile();
p.setText('name');
p.setText(['a', 'b']);
p.chash = true;

console.log(p.makeCalls().map(x => Buffer.from(x).toString('hex')));

let r = Record.from({
	name: 'Chonker',
	'#chash': 'https://raffy.antistupid.com', 
	'$eth': '0x51050ec063d393217B436747617aD1C2285Aeeee'.toLowerCase(),
});

console.log([...r]);

// console.log([...Coin]);
// console.log(Coin.count);


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