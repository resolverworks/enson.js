import test from 'node:test';
import assert from 'node:assert/strict';
import {Address} from '../src/Address.js';
import {Coin} from '../src/Coin.js';
import { bytes_from } from '../src/utils.js';

function title(x) {
	return `$${x.name}/${x.type}`;
}

test('Coin', async T => {
	let known = [
		{name: 'btc', type: 0n},
		{name: 'eth', type: 60n, chain: 1}
	];
	for (let x of known) {
		await T.test(title(x), async TT => {
			await TT.test('fromName', () => assert.equal(Coin.fromName(x.name).type, x.type));
			await TT.test('fromType', () => assert.equal(Coin.fromType(x.type).name, x.name));
			if (x.evm) {
				await TT.test('fromChain', () => assert.equal(Coin.fromChain(x.chain).type, x.type));
			}
		});
	}
});

test('Address', async T => {
	let known = [
		{
			coin: Coin.from('eth'),
			input: '0x51050ec063d393217B436747617aD1C2285Aeeee',
			bytes: bytes_from('0x51050ec063d393217B436747617aD1C2285Aeeee')
		},
		{
			coin: Coin.from('btc'),
			input: 'bc1q9ejpfyp7fvjdq5fjx5hhrd6uzevn9gupxd98aq',
			bytes: bytes_from('0x00142e6414903e4b24d05132352f71b75c165932a381'),
		}
	];
	for (let x of known) {
		await T.test(title(x.coin), async TT => {
			await TT.test('from string', () => assert.deepEqual(Address.from(x.coin, x.input).bytes, x.bytes));
			await TT.test('from bytes', () => assert.equal(Address.from(x.coin.type, x.bytes).value, x.input));
		});

	}
});
