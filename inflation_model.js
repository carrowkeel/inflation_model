"use strict";

// Math functions
const randint = (m,m1) => Math.floor(Math.random() * (m1 - m)) + m;
const round = (n,p) => { const f = Math.pow(10, p); return Math.round(n * f) / f }
const sum = arr => arr.reduce((a,v)=>a+v,0);
const range = (start,end) => Array(end-start).fill(0).map((v,i)=>i+start);
const vcomp = (a,b,m) => a.map((v,i) => Array.isArray(v)?vcomp(v,b[i],m):b[i]!=null?(m==2?v*b[i]:m==1?v-b[i]:v+b[i]):v);
const vcol = (arr, col=0, f=(v)=>v) => { const o = []; for(const i of arr){const v=f(i[col]);if(v!==false){o.push(v)}} return o};
const vfilter = (arr, f) => { const o = []; for (const i of arr) { const v=f(i); if(v){o.push(i)} } return o };
const vshuffle = arr => Array(arr.length).fill(0).map((v,i)=>[i,Math.random()]).sort((a,b)=>a[1]-b[1]).map(v=>arr[v[0]]);
const mean = arr => arr.reduce((a,v)=>a+v,0)/arr.length;
const colmean = arr => arr.length === 0 ? [] : arr.reduce((a,v)=>a.map((_v,i)=>_v+v[i]), new Array(arr[0].length).fill(0)).map(v=>v/arr.length);
const stddev = arr => Math.pow(vcomp(Array(arr.length).fill(-mean(arr)),arr).map((v)=>Math.pow(v,2)).reduce((a,b)=>a+b) / (arr.length - 1), 0.5);
const randchoice = (total, select) => vshuffle(range(0, total)).slice(0, select);
const randof = (choices) => { const o = []; const i = choices.length; for (const x in choices[0]) { o.push(choices[randint(0,i)][x]); } return o; };

const init_options = _options => {
	const signals = _options['signals'] ? _options['signals'] : [1, 0];
	const defaults = {
		steps: 2000,
		signals: signals,
		_qi: 1,
		_ri: 2,
		_ai: 3,
		_sl: 3 + signals.length,
		_mi: 3 + signals.length * 2,
		maxmated: 3,
		maxchoice: 15,
		muts: 20,
		recmuts: 5,
		qualityspread: 0.25,
		mutationstep: 0.25,
		offspring: 3,
		signallimit: 1,
		popsize: 500,
		prefresolution: 0.1,
		initialadvertising: 0.5
	}
	const options = Object.assign({}, defaults, _options);
	return options;
};

const init_agents = options => {
	return Array.from(new Array(options.popsize)).map(v => [
		randint(0,2),
		(Math.random()/2)+0.25,
		randint(0, options.signals.length),
		...Array(options.signals.length).fill(0).map((v,i)=>options.initialadvertising),
		...Array(options.signals.length).fill(0), // Actual signal level (not inherited)
		0, // Times mated - cache, not inherited
	]);
};

const siglevel = (options, agent, cue, signalcost) => {
	const sig = agent[options._qi] * agent[options._ai+cue];
	const sigcost = agent[options._qi] * (agent[options._ai+cue] - options.initialadvertising) * signalcost;
	return [Math.min(sig, options.signallimit), sigcost];
};

const step = (t, _agents, options) => {
	if (_agents.length === 0 || t === options.steps)
		return [];

	const mn = vcol(_agents,0,(v)=>v===0?true:false).length;
	const fn = vcol(_agents,0,(v)=>v===1?true:false).length;

	if (mn === 0 || fn === 0) // End if either males or females are 0
		return [];

	const survived = [];
	for (const a of _agents) {
		let q_a = a[options._qi]; // actual quality
		if (a[0] === 0) {
			// Calculate signal level
			for (const s of range(0, options.signals.length)) {
				const [sig, cost] = siglevel(options, a, s, options.signals[s]);
				a[options._sl+s] = sig;
				q_a -= cost;
			}
		}
		if (Math.random() > 1 - q_a)
			survived.push(a);
	}

	const agents = survived.slice(0);

	if (agents.length === 0) // End if the population is 0
		return [];

	const males = vfilter(agents, (v)=>v[0]===0);
	const females = vfilter(agents, (v)=>v[0]===1);
	if (males.length === 0 || females.length === 0) // End if either males or females are 0
		return [];

	const next = [];

	for (const a of females) {
		if (males.length === 0)
			break; // No more potential males;
		const h = males.length < options.maxchoice ? males.length : options.maxchoice; // Number of males in subset
		const ind = randchoice(males.length, h); // Spatial/temporal limitation, array of indexes
		const signals = [];
		const index = {};
		for (const p of ind) {
			signals.push(males[p][options._sl+a[options._ri]]);
			index[males[p][options._sl+a[options._ri]]] = p;
		}

		const threshold = Math.max(...signals) - options.prefresolution;
		const potential = signals.filter(v=>v>=threshold);
		const chosen = index[potential[randint(0, potential.length)]];

		males[chosen][options._mi] += 1;

		for (const _x of range(0, options.offspring)) {
			const f1 = randof([a, males[chosen]]);
			f1[options._mi] = 0; // Reset times mated;
			f1[options._qi] = (a[options._qi] + males[chosen][options._qi]) / 2;
			f1[options._qi] += options.qualityspread * (Math.random()-0.5); // Uniform distribution
			f1[options._qi] = f1[options._qi] > 1 ? 1 : f1[options._qi];
			next.push(f1);
		}
		// Remove male from potential males if reached maxmated
		if (males[chosen][options._mi] >= options.maxmated)
			males.splice(chosen,1);
	}

	const shuffled = vshuffle(next).slice(0, options.popsize); // Randomize mating sequence

	for (const a of randchoice(shuffled.length, options.recmuts)) {
		shuffled[a][options._ri] = randint(0, options.signals.length);
	}
	for (const a of randchoice(shuffled.length, options.muts)) {
		const mutsig = randint(options._ai, options._ai+options.signals.length);
		shuffled[a][mutsig] += options.mutationstep * (Math.random()-0.5);
		shuffled[a][mutsig] = shuffled[a][mutsig] < options.initialadvertising ? options.initialadvertising : shuffled[a][mutsig];
	}

	return shuffled;
};

////////////////////////////////////////////////////////////////////////////////
// Example use:

// Produce stats from individual step, this example averages preference for each signal
const stats = (step, options) => {
	if (step.length === 0)
		return [];
	const rechist = Array(options.signals.length).fill(0);
	for (const agent of step)
		rechist[agent[options._ri]] += 1;
	return range(0, options.signals.length).map(s => rechist[s]/step.length);
};

const runSimulation = () => {
	// Custom options, defaults reflect those used in simulations with both signalling constraints
	const _options = {
		signals: [1, 0], // Marginal costs of signals (S_1 and S_2)
		steps: 1000, // Number of steps to run simulation
		signallimit: 1, // Signal magnitude limit, set to Infinity for no limit
		prefresolution: 0.1, // Perceptive error, 0=no limit, increasing this value reduces perception
	};
	const options = init_options(_options);
	const agents = init_agents(options);
	 // Generate raw simulation data (agents per step), note that simulation may terminate (population collapse) before reaching target step number
	const simulation_data = range(0, options.steps)
		.reduce((a,t)=>a.concat([step(t, a[a.length-1], options)]), [agents])
		.filter(v=>v.length>0);
	const step_preference_data = simulation_data.map(v=>stats(v, options)); // Proportion of preference for S_1 and S_2 in each step
	const mean_preference_data = colmean(step_preference_data); // Mean proportion of preference for S_1 and S_2
	console.log(mean_preference_data); // Prints simulation result
};

runSimulation();

////////////////////////////////////////////////////////////////////////////////

