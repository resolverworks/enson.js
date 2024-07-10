import {Record, Profile} from '../../src/index.js';

let r = new Record();
r.set('name', 'raffy');
r.set('description', 'chonk');

r.set('$eth', '0x1934FC75aD10d7eEd51dc7A92773cAc96A06BE56');
r.set('$btc', 'bc1q9ejpfyp7fvjdq5fjx5hhrd6uzevn9gupxd98aq');
r.set('$doge', 'DKcAMwyEq5rwe2nXUMBqVYZFSNneCg6iSL');

r.set('#ipfs', 'bafybeiawq7pbt4krnopfmcvymvp2uz4ohibd5p7ugskkybvdmwa2v7evpy');
r.set('#ipns', 'k51qzi5uqu5dl6mkhgsua6663hpyb7zs8qjh5blic33j5393iie8abot6jydfh');
r.set('#ar', 'yBYkngZXGCQgYU-nUCwo5vns2ALUU0LXXZrCUlUUWkk');



// same as #name => name()
r.set(Record.NAME, 'raffy.eth');

// same as #pubkey
r.set(Record.PUBKEY, {x: 1, y: 2});

// same as #contenthash
r.set(Record.CHASH, '0xe301017012201687de19f1516b9e560ab8655faa678e3a023ebff43494ac06a36581aafc957e');
r.set('#html', '<b>chonk</b>');
r.setChash('<b>chonk</b>', 'html');
r.set('#json', {nice: 'chonk'});

console.log(r);
console.log(r.toObject());
console.log(JSON.stringify(r.toJSON(), null, '  '));
console.log(JSON.stringify(r.toJSON(true), null, '  '));

console.log(Profile.from(r));
console.log(Profile.from(r).size);

console.log(Profile.from(r).toJSON(true));
console.log([...Profile.from(r)]);

for (let a of r) {
	console.log(a);
}
