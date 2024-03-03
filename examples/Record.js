import { ContentHash } from '../src/ContentHash.js';
import {Record} from '../src/Record.js';

let rec = new Record();
rec.put('name', 'raffy');
rec.put('description', 'chonk');

rec.put('$eth', '0x1934FC75aD10d7eEd51dc7A92773cAc96A06BE56');
rec.put('$btc', 'bc1q9ejpfyp7fvjdq5fjx5hhrd6uzevn9gupxd98aq');
rec.put('$doge', 'DKcAMwyEq5rwe2nXUMBqVYZFSNneCg6iSL');

rec.put('#ipfs', 'bafybeiawq7pbt4krnopfmcvymvp2uz4ohibd5p7ugskkybvdmwa2v7evpy');
rec.put('#ipns', 'k51qzi5uqu5dl6mkhgsua6663hpyb7zs8qjh5blic33j5393iie8abot6jydfh');
rec.put('#ar', 'yBYkngZXGCQgYU-nUCwo5vns2ALUU0LXXZrCUlUUWkk');


// same as #pubkey
rec.put(Record.PUBKEY, {x: 1, y: 2});

// same as #contenthash
rec.put(Record.CONTENTHASH, '0xe301017012201687de19f1516b9e560ab8655faa678e3a023ebff43494ac06a36581aafc957e');

rec.put(Record.CONTENTHASH, ContentHash.fromEntry('html', '<b>chonk</b>'));
rec.put('#html', '<b>chonk</b>');
rec.put('#json', {nice: 'chonk'});

console.log(rec);
console.log(rec.toJSON());

console.log(rec.toObject());


// readme

let vitalik = Record.from({
	name: 'Vitalik',
	$eth: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
	$btc: '1A1zP1eP5QGefi2D' + 'MPTfTL5SLmv7DivfNa', // satoshi's address triggers windows defender 🤡️
	avatar: 'eip155:1/erc1155:0xb32979486938aa9694bfc898f35dbed459f44424/10063',
	'#ipfs': 'k2jmtxrxbr58aa3716vvr99qallufj3qae595op83p37jod4exujup32',
});

console.log(vitalik.toJSON());
console.log(vitalik.addr(60));
console.log(vitalik.contenthash());
