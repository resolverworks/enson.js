import test from 'node:test';
import assert from 'node:assert/strict';
import {Address} from '../src/Address.js';
import {Coin} from '../src/Coin.js';
import {array_equals, bytes_from_phex} from '../src/utils.js';

test('Address', async T => {
	let known = [
		{
			name: 'eth',
			type: 60,
			input: '0x51050ec063d393217B436747617aD1C2285Aeeee',
			bytes: bytes_from_phex('0x51050ec063d393217B436747617aD1C2285Aeeee')
		},
		{
			name: 'btc',
			type: 0,
			input: 'bc1q9ejpfyp7fvjdq5fjx5hhrd6uzevn9gupxd98aq',
			bytes: bytes_from_phex('0x00142e6414903e4b24d05132352f71b75c165932a381'),
		}
	];
	for (let x of known) {
		await T.test(`$${x.name}/${x.type}`, async TT => {
			await TT.test('by name', () => assert(Coin.fromType(x.type).name === x.name));
			await TT.test('by type', () => assert(Coin.from({name: x.name}).type === x.type));
			await TT.test('fromEntry', () => assert(array_equals(Address.from(x.name, x.input).bytes, x.bytes)));
			await TT.test('fromParts', () => assert(Address.fromParts(x.type, x.bytes).toString() == x.input));
		});

	}
});
