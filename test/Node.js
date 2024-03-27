import test from 'node:test';
import assert from 'node:assert/strict';
import {Node, phex_from_bytes, namehash} from '../src/index.js';

test('Node', async T => {
	await T.test('normalized', () => {
		assert.equal(Node.create('RAFFY').name, 'raffy');
	});
	await T.test('beautified', () => {
		assert.equal(Node.create('0⃣').prettyName, '0️⃣');
	});
	await T.test('namehash', () => {
		const name = 'raffy.eth';
		const hash = '0x9c8b7ac505c9f0161bbbd04437fce8c630a0886e1ffea00078e298f063a8a5df';
		assert.equal(phex_from_bytes(Node.create(name).namehash), hash);
		assert.equal(phex_from_bytes(namehash(name)), hash);
		assert.equal(phex_from_bytes(namehash(name.split('.'))), hash);
	});
	await T.test('labelhash', () => {
		assert.equal(phex_from_bytes(Node.create('eth').labelhash), '0x4f5b812789fc606be1b3b16908db13fc7a9adf7ca72641f84d75b47069d3d7f0');
		assert.equal(phex_from_bytes(Node.root().labelhash), '0x0000000000000000000000000000000000000000000000000000000000000000');
	});
	await T.test('depth', () => {
		assert.equal(Node.create('a.b.c.d.e').depth, 5);
	});
	await T.test('root', () => {
		let root = Node.root();
		let deep = root.create('a.b.c.d.e');
		assert.equal(deep.root, root);
	});
	await T.test('flat', () => {
		let root = Node.root();
		let node = root.create('a.b.c.d.e');
		assert.equal(node.flat().length, 1);
		assert.equal(root.flat().length, 6);
		assert.equal(root.flat().at(-1), node);
		assert.equal(root.flat().at(0), root);
	});
	await T.test('path', () => {
		let root = Node.root();
		let deep = root.create('a.b.c.d.e');
		assert.equal(deep.path().length, 5);
		assert.equal(deep.path(true).length, 6);
	});
	await T.test('nodeCount', () => {
		let root = Node.root();   // +1
		root.create('e.d.c.b.a'); // +5
		root.create('h.g.b.a');   // +2
		root.create('i.a');       // +1
		root.create('j');         // +1
		assert.equal(root.nodeCount, 10);
	});
});
