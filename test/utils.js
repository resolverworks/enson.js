import {test} from 'node:test';
import assert from 'node:assert/strict';
import {array_equals, dns_encoded, namehash, namesplit} from '../src/utils.js';

test('array_equals', T => {
	['', false, undefined, null].forEach((x, i, v) => {
		assert(!array_equals([], x));
		assert(!array_equals(x, []));
		for (let j = 0; j < i; j++) {
			assert(array_equals(x, v[j]));
		}
	});
});

test('namesplit', () => {
	assert.deepEqual(namesplit(''), []);
	assert.deepEqual(namesplit([]), []);
	assert.deepEqual(namesplit(['raffy', 'eth']), ['raffy', 'eth']);
	assert.deepEqual(namesplit('raffy.eth'), ['raffy', 'eth']);
});

test('namehash', () => {
	assert(namehash(''),          '0x0000000000000000000000000000000000000000000000000000000000000000');
	assert(namehash('raffy.eth'), '0x9c8b7ac505c9f0161bbbd04437fce8c630a0886e1ffea00078e298f063a8a5df');
	assert(namehash('Raffy.eth'), '0x9e4452347c5d3e7fca6c1c98a0d42b1d9344353266e46769b9a7a14ecc247d45');
});

test('dns_encoded', () => {
	assert(dns_encoded(''), '0x00');
	assert(dns_encoded('raffy.eth'), '0x0572616666790365746800');
});
