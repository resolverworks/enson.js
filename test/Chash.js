import test from 'node:test';
import assert from 'node:assert/strict';
import {Chash, IPFS} from '../src/Chash.js';

test('IPFS', async T => {
	await T.test('codec',  () => assert(IPFS.codec, 0xE3));
	await T.test('name',   () => assert(IPFS.name, 'IPFS'));
	await T.test('scheme', () => assert(IPFS.scheme, 'ipfs'));
});

test('Onion', async T => {
	// https://github.com/torproject/torspec/blob/main/rend-spec-v3.txt
	await T.test('example 1', () => Chash.fromOnion('pg6mmjiyjmcrsslvykfwnntlaru7p5svn6y2ymmju6nubxndf4pscryd'));
	await T.test('example 2', () => Chash.fromOnion('sp3k262uwy4r2k3ycr5awluarykdpag6a7y33jxop4cs2lu5uz5sseqd'));
	await T.test('example 3', () => Chash.fromOnion('xa4r2iadxm55fbnqgwwi5mymqdcofiu3w6rpbtqn7b2dyn7mgwj64jyd'));
	await T.test('explicit', () => {
		const chash = Chash.fromOnion('p53lf57qovyuvwsc6xnrppyply3vtqm7l6pcobkmyqsiofyeznfu5uqd');
		const {protocol: {codec}, pubkey, checksum, version, url} = chash.toObject();
		assert.equal(codec, 445);
		assert.deepEqual(pubkey, Uint8Array.of(
			127, 118, 178, 247, 240, 117, 113, 74,
			218,  66, 245, 219,  23, 191,  15, 94,
			 55,  89, 193, 159,  95, 158,  39,  5,
			 76, 196,  36, 135,  23,   4, 203, 75));
		assert.deepEqual(checksum, Uint8Array.of(78, 210));
		assert.equal(version, 3);
		assert.equal(url, 'http://p53lf57qovyuvwsc6xnrppyply3vtqm7l6pcobkmyqsiofyeznfu5uqd.onion');
	});
});

test('Chash', async T => {	
	
	await T.test('invalid: empty string', () => assert.throws(() => Chash.from('')));
	await T.test('invalid: empty bytes', () => assert.throws(() => Chash.from(new Uint8Array(0))));
	await T.test('invalid: null', () => assert.throws(() => Chash.from(null)));
	await T.test('invalid: overflow', () => assert.throws(() => Chash.from(Uint8Array.of(128))));

	await T.test("Vitalik's Blog on IPFS", async TT => {
		let raw = '0xe301017012201687de19f1516b9e560ab8655faa678e3a023ebff43494ac06a36581aafc957e';
		let hash = 'k2jmtxrxbr58aa3716vvr99qallufj3qae595op83p37jod4exujup32';

		let ch = Chash.fromBytes(raw);
		let url =`${IPFS.scheme}://${hash}`;
		
		await TT.test('from', () => assert.deepEqual(ch.bytes, Chash.from(hash, IPFS.scheme).bytes));
		await TT.test('fromParts', () => assert.deepEqual(ch.bytes, Chash.fromParts(IPFS.codec, ch.data).bytes));
		await TT.test('fromURL',   () => assert.deepEqual(ch.bytes, Chash.fromURL(url).bytes));

		await TT.test('toHash', () => assert.equal(ch.toHash(), hash));
		await TT.test('toEntry', () => assert.deepEqual(ch.toEntry(), [IPFS.scheme, hash]));
		await TT.test('toGatewayURL', () => assert.equal(ch.toGatewayURL(), `https://cloudflare-ipfs.com/ipfs/${hash}`));
		await TT.test('toPhex', () => assert.equal(ch.toPhex(), raw));
		await TT.test('toURL', () => assert.equal(ch.toURL(), url));
	})
});
