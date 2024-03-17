import {Record, Profile} from '../src/Record.js';

let r = new Record();
r.put('name', 'raffy');
r.put('description', 'chonk');

r.put('$eth', '0x1934FC75aD10d7eEd51dc7A92773cAc96A06BE56');
r.put('$btc', 'bc1q9ejpfyp7fvjdq5fjx5hhrd6uzevn9gupxd98aq');
r.put('$doge', 'DKcAMwyEq5rwe2nXUMBqVYZFSNneCg6iSL');

r.put('#ipfs', 'bafybeiawq7pbt4krnopfmcvymvp2uz4ohibd5p7ugskkybvdmwa2v7evpy');
r.put('#ipns', 'k51qzi5uqu5dl6mkhgsua6663hpyb7zs8qjh5blic33j5393iie8abot6jydfh');
r.put('#arweave', 'yBYkngZXGCQgYU-nUCwo5vns2ALUU0LXXZrCUlUUWkk');

// same as #pubkey => pubkey()
r.put(Record.PUBKEY, {x: 1, y: 2});

// same as #contenthash => contenthash()
r.put(Record.CHASH, '0xe301017012201687de19f1516b9e560ab8655faa678e3a023ebff43494ac06a36581aafc957e');

// same as #name => name()
r.put(Record.NAME, 'raffy.eth');

console.log(r);
console.log(r.toJSON());
console.log(JSON.stringify(r.toJSON()));
console.log(r.toObject());

console.log(Profile.from(r));
console.log(Profile.from(r).size);