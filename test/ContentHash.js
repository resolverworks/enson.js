import test from 'node:test';
import assert from 'node:assert/strict';
import {ContentHash, IPFS} from '../src/ContentHash.js';

test('IPFS', async T => {
	await T.test('codec',  () => assert(IPFS.codec, 0xE3));
	await T.test('name',   () => assert(IPFS.name, 'IPFS'));
	await T.test('scheme', () => assert(IPFS.scheme, 'ipfs'));
});

test('ContentHash', async T => {	
	await T.test("Vitalik's Blog on IPFS", async TT => {
		let raw = '0xe301017012201687de19f1516b9e560ab8655faa678e3a023ebff43494ac06a36581aafc957e';
		let hash = 'k2jmtxrxbr58aa3716vvr99qallufj3qae595op83p37jod4exujup32';

		let ch = ContentHash.fromBytes(raw);
		let url =`${IPFS.scheme}://${hash}`;
		
		await TT.test('fromEntry', () => assert.deepEqual(ch.bytes, ContentHash.fromEntry(IPFS.scheme, hash).bytes));
		await TT.test('fromParts', () => assert.deepEqual(ch.bytes, ContentHash.fromParts(IPFS.codec, ch.data).bytes));
		await TT.test('fromURL',   () => assert.deepEqual(ch.bytes, ContentHash.fromURL(url).bytes));

		await TT.test('toHash', () => assert.equal(ch.toHash(), hash));
		await TT.test('toEntry', () => assert.deepEqual(ch.toEntry(), [IPFS.scheme, hash]));
		await TT.test('toGatewayURL', () => assert.equal(ch.toGatewayURL(), `https://cloudflare-ipfs.com/ipfs/${hash}`));
		await TT.test('toPhex', () => assert.equal(ch.toPhex(), raw));
		await TT.test('toURL', () => assert.equal(ch.toURL(), url));
	})
});
