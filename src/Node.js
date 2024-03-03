import {split_norm, error_with} from './utils.js';
import {Record} from './Record.js';

const LABEL_SELF = '.';

export class Node extends Map {
	static root(name) {
		return new this(`[${name || 'root'}]`);
	}
	constructor(label, parent) {
		super();
		this.label = label;
		this.parent = parent || null;
		this.record = null;
	}
	// get node "a" from "a.b.c" or null
	// find("") is identity
	find(name) {
		return split_norm(name).reduceRight((x, s) => x?.get(s), this);
	}
	// ensures the nodes for "a.b.c" exist and returns "a"
	create(name) {
		return split_norm(name).reduceRight((x, s) => x.ensureChild(s), this);
	}
	// gets or creates a subnode of this node
	ensureChild(label) {
		let node = this.get(label);
		if (!node) {
			node = new Node(label, this);
			this.set(label, node);
		}
		return node;
	}
	importJSON(json) {
		try {
			if (typeof json !== 'object' || Array.isArray(json)) throw new Error('expected object');
			let record = json[LABEL_SELF];
			this.record = Record.from(record || json);
			if (record) {
				for (let [ks, v] of Object.entries(json)) {
					ks = ks.trim();
					if (!ks || ks === LABEL_SELF) continue;
					for (let k of ks.split(/\s+/)) {
						this.create(k).import_from_json(v);
					}
				}
			}
		} catch (err) {
			throw error_with(`Importing "${this.name}": ${err.message}`, {json}, err);
		}
	}
	toJSON() {
		if (this.record && !this.size) {
			return this.record.toJSON();
		}
		let json = {};
		if (this.record) {
			json[LABEL_SELF] = this.record.toJSON();
		}
		for (let [k, v] of this) {
			json[k] = v.toJSON();
		}
		return json;
	}
	*records() {
		let {record} = this;
		if (record) yield record;
		for (let x of this.values()) {
			yield* x.records();
		}
	}
	*nodes() {
		yield this;
		for (let x of this.values()) {
			yield* x.nodes();
		}
	}
	get name() {
		if (!this.parent) return this.label;
		let v = [];
		for (let node = this; node.parent; node = node.parent) {
			v.push(node.label);
		}
		return v.join('.');
	}
	scan(fn, level = 0) {
		fn(this, level++);
		for (let x of this.values()) {
			x.scan(fn, level);
		}
	}
	print() {
		this.scan((x, n) => {
			console.log(`${'  '.repeat(n)}${x.label}${x.record?'*':''} (${x.size})`);
		});
	}
}
