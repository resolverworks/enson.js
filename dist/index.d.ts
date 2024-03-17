export type ToBigInt = number | string | BigInt;
export type ToData = Uint8Array | number[] | string;

export class Pubkey {
	static fromXY(x: ToBigInt, y: ToBigInt): Pubkey;
	static from(value: Uint8Array | string | {x: ToBigInt, y: ToBigInt}): Pubkey;
	constructor(v?: Uint8Array);
	set x(i: ToBigInt);
	set y(i: ToBigInt);
	get x(): Uint8Array;
	get y(): Uint8Array;
	toAddress(): string;
	toObject(): {x: Uint8Array, y: Uint8Array};
	toPhex(): string;
	toJSON(): {x: string, y: string};
}

export type GatewayFn = (hash: string, spec: ChashSpec, data: Uint8Array) => string;
export class ChashSpec {
	readonly codec: number;
	readonly name: string;
	readonly scheme?: string;
	gateway?: GatewayFn;
}
export const Onion: ChashSpec | {
	fromPubkey(pubkey: ToData, version?: number): Uint8Array;
};
export const GenericURL: ChashSpec;
export const DataURL: ChashSpec;
export const IPFS: ChashSpec;
export const IPNS: ChashSpec;
export const Swarm: ChashSpec;
export const Arweave: ChashSpec;

export class Chash {
	static from(value: any, hint?: string): Chash;
	static fromParts(codec: number | ChashSpec, data: ToData): Chash;
	static fromOnion(hash: ToData): Chash;
	static fromBytes(raw: ToData): Chash;
	static fromURL(url: string | URL): Chash;
	constructor(v: Uint8Array);
	readonly bytes: Uint8Array;
	get codec(): number;
	get spec(): ChashSpec;
	get data(): Uint8Array;
	toHash(): string;
	toObject(): object;
	toEntry(): [key: string, value: string];
	toURL(): string;
	toGatewayURL(): string;
	toPhex(): string;
	toJSON(): string;
}

export type CoinQuery = Coin | ToBigInt | {name?: string, type?: ToBigInt, chain?: number};

export class Coin {
	static get count(): number;
	static [Symbol.iterator](): IterableIterator<Coin>;
	static from(query: CoinQuery): Coin;
	static fromType(type: ToBigInt): Coin;
	static fromName(name: string): Coin;
	static fromChain(chain: number): Coin;
	readonly type: bigint;
	get name(): string;
	get title(): string;
	get chain(): number | undefined;
	get isUnknown(): boolean;
	toObject(): {type: bigint, name: string, title: string, chain: number | undefined};
	parse(s: string): Uint8Array;
	format(v: Uint8Array): string;
}

export class Address {
	static from(query: CoinQuery, value?: string): Address;
	readonly coin: Coin;
	readonly bytes: Uint8Array;
	get value(): string;
	toObject(): {coin: Coin, value: string, bytes: Uint8Array};
	toPhex(): string;
	toJSON(): string;
}

export class Profile {
	static from(x: any): Profile;
		
	get size(): number;
	texts: Set<string>;
	coins: Set<Coin>;
	chash: boolean;
	pubkey: boolean;
	name: boolean;	
	addr0: boolean;

	clear(): void;
	setCoin(query: CoinQuery | CoinQuery[], on?: boolean): void;
	setText(key: string | string[], on?: boolean): void;
	makeCallsForName(name: string): Uint8Array[];
	makeCalls(node: ToData): Uint8Array[];
	createRecord(answers: ToData[]): Record;
}

export type KeyedObject = {[key: string]: any};

export class Record {
	static readonly CHASH: Symbol;
	static readonly PUBKEY: Symbol;
	static readonly NAME: Symbol;

	static from(json: KeyedObject): Record;
	get size(): number;
	
	[Symbol.iterator](): Generator<[key: string, value: KeyedObject], void, unknown>;
	put(key: string, value?: any): void;
	
	text(key: string): string | undefined;
	addr(type: Coin | number): Uint8Array | undefined;
	
	chash: Chash | undefined;
	pubkey: Pubkey | undefined;
	name: string | undefined;	
	addr0: Address | undefined;
	
	toObject(): KeyedObject;
	toJSON(): KeyedObject;
	toEntries(): [key: string, value: any][];


}

export class Node extends Map {
	static root(name?: string): Node;
	constructor(label: string, parent?: Node);

	readonly label: string;
	readonly parent: Node;
	record?: Record;

	get name(): string;
	get depth(): number;
	get nodes(): number;

	find(name: string): Node | undefined;
	create(name: string): Node;
	child(label: string): Node;
	importJSON(json: any): void;

	scan(fn: (node: Node, level: number) => void, level?: number): void;
	collect<T>(fn: (node: Node, level: number) => T | undefined): T[];
	flat(): Node[];
	print(): void;
}

// export function error_with(message: string, options: Object, cause?: any): Error;
// export function is_number(x: any): boolean;
// export function is_string(x: any): boolean;
// export function maybe_phex(x: any): boolean;
// export function bytes_from_data(x: ToData): Uint8Array;
// export function bytes32_from(x: ToBigInt | Uint8Array): Uint8Array;
