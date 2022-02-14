import DynamicTimeWarping from "dynamic-time-warping-ts"; 
import { BGMs } from "./BGMs";

const analyserOptions = {
	fftSize: 32768, // 32768 max
	smoothingTimeConstant: 0.25, //0.5,
	intervalSpeed: 100,
	minSearchSize: 1, // In seconds
	maxSearchSize: 10
}

const drawOptions = {
	curveXScale: 3,
	curveYScale: 3000
}

const streamOptions = {
	video: false,
	audio: true
}

const pitch: {[key: string]: number} = {
	C: 523.25,
	Db: 554.37,
	D: 587.33,
	Eb: 622.25,
	E: 659.25,
	F: 698.46,
	Gb: 739.99,
	G: 783.99,
	Ab: 830.61,
	A: 880.00,
	Bb: 932.33,
	B: 987.77,
	C2: 1046.50
}

class Audio {
	data: Uint8Array | null;
	curvePoints: number[];
	prevCurvePoints: number[];
	interval: NodeJS.Timer | null;
	analyser: AnalyserNode | null;
	graph: HTMLCanvasElement | null;
	curve: HTMLCanvasElement | null;
	enabled: boolean = false;
	sampleRate: number = 0;
	guesses: { [key: string]: number };

    constructor(graph: HTMLCanvasElement, curve: HTMLCanvasElement) {
		this.data = null;
		this.curvePoints = [];
		this.prevCurvePoints = [];
		this.interval = null;
		this.analyser = null;
		this.graph = graph;
		this.curve = curve;
		this.guesses = {};

		this.init();
    }

	async init(): Promise<void> {
		await this.initAnalyser();
		this.initInterval(analyserOptions.intervalSpeed);
	}

	public get isEnabled(): boolean {
		return this.enabled;
	}

	public toggleEnable(): void {
		this.enabled = !this.enabled;
	}

	private findNearestPitch(freq: number): string {
		let result: string = "";

		if (freq <= 0) {
			return "";
		} else if (freq < pitch.C) {
			result = this.findNearestPitch(freq * 2);
		} else if (freq > pitch.C2) {
			result = this.findNearestPitch(freq / 2);
		} else {
			result = Object.entries(pitch).sort((a: [string, number], b: [string, number]) => {
				if (Math.abs(a[1] - freq) < Math.abs(b[1] - freq)) {
					return -1;
				}

				return 0;
			})[0][0];
		}

		return result;
	}

    private async initAnalyser(): Promise<void> {
		if (navigator.mediaDevices.getUserMedia !== null) {
			try {
				const audioCtx: AudioContext = new AudioContext();
				this.analyser = audioCtx.createAnalyser();
				this.analyser.fftSize = analyserOptions.fftSize;
				this.analyser.smoothingTimeConstant = analyserOptions.smoothingTimeConstant;
				audioCtx.createMediaStreamSource(await navigator.mediaDevices.getUserMedia(streamOptions)).connect(this.analyser);
				this.sampleRate = audioCtx.sampleRate;
				this.data = new Uint8Array(this.analyser.frequencyBinCount);
			} catch (err) {
				console.error("Failed to initialize analyser!", err);
			}
		}
	}

	private initInterval(speed: number): void {
		if (this.data === null || this.analyser === null) {
			console.error("Variables have not been initialized");
			return;
		}

		this.enabled = true;

		this.interval = setInterval(() => {
			if (this.enabled) {
				this.analyser!.getByteFrequencyData(this.data!);
				this.draw();
			}
		}, speed);
	}
	
	private draw(): void {
		if (!this.data || !this.graph || !this.curve) {
			return;
		} 

		const bufferLength: number = this.analyser!.frequencyBinCount;
		const graphCtx: CanvasRenderingContext2D = this.graph.getContext("2d")!;
		const curveCtx: CanvasRenderingContext2D = this.curve.getContext("2d")!;
		const graphWidth: number = this.graph.width;
		const graphHeight: number = this.graph.height;
		const curveWidth: number = this.curve.width;
		const curveHeight: number = this.curve.height;
		const barWidth: number = (graphWidth / bufferLength) * 2.5;
		let max_val: number = -Infinity;
		let max_index: number = -1;

		/* Draw some graph stuff */
		graphCtx.fillStyle = 'rgb(0, 0, 0)';
		graphCtx.fillRect(0, 0, graphWidth, graphHeight);

		this.data.forEach((barHeight: number, index: number) => {
			if (barHeight > 100 && barHeight < 1100 && barHeight > max_val) {
				max_val = barHeight;
				max_index = index;
			}

			graphCtx.fillStyle = 'rgb(' + (barHeight + 100) + ', 50, 50)';
			graphCtx.fillRect(index * barWidth, graphHeight - (barHeight / 2), barWidth, barHeight);
		});

		const fundamentalFreq: number = this.sampleRate * (max_index / analyserOptions.fftSize);
		const foundPitch: string = this.findNearestPitch(fundamentalFreq);

		graphCtx.strokeStyle = 'rgb(0, 255, 0)';
		graphCtx.strokeRect(0, graphHeight - (max_val / 2), graphWidth, 1);

		graphCtx.strokeStyle = 'rgb(255, 255, 0)';
		graphCtx.strokeRect(max_index * barWidth, 0, 1, graphHeight);
		
		graphCtx.fillStyle = 'rgb(0, 0, 255)';
		graphCtx.font = '48px serif';
		graphCtx.fillText(foundPitch, graphWidth - 75, 50);

		if (this.curvePoints.length > (analyserOptions.maxSearchSize * 1000) / analyserOptions.intervalSpeed) {
			this.curvePoints = [];
		}

		this.curvePoints.push(fundamentalFreq);

		curveCtx.fillStyle = 'rgb(0, 0, 0)';
		curveCtx.fillRect(0, 0, curveWidth, curveHeight);

		curveCtx.strokeStyle = 'rgb(255, 255, 0)';
		curveCtx.beginPath();
		curveCtx.moveTo(0, 0);

		this.curvePoints.forEach((yVal: number, index: number) => {
			const adjustedYVal: number = curveHeight * yVal / drawOptions.curveYScale;
			curveCtx.lineTo(index * drawOptions.curveXScale, curveHeight - (adjustedYVal));
		});

		curveCtx.stroke();

		if (this.curvePoints.length >= (analyserOptions.minSearchSize * 1000) / analyserOptions.intervalSpeed) {
			let bestMatch: number = Infinity;
			let bestMatchName: string = "";

			Object.entries(BGMs).forEach(([key, value]: [string, number[]]) => {
				const yVals: number[] = [...value];

				while (yVals.length) {
					const matchScore: number = new DynamicTimeWarping(this.curvePoints, yVals.splice(0, this.curvePoints.length), (a: number, b: number) => Math.abs(a - b)).getDistance();

					if (matchScore < bestMatch) {
						bestMatch = matchScore;
						bestMatchName = key;
					}
				}
			})

			this.guesses[bestMatchName] = (this.guesses[bestMatchName] || 0) + 1;

			console.log(JSON.stringify(this.guesses));
		}

		/*if(this.prevCurvePoints.length) {
			const dtw1: DynamicTimeWarping<number> = new DynamicTimeWarping(this.curvePoints, this.prevCurvePoints, (a: number, b: number) => Math.abs(a - b));

			curveCtx.strokeStyle = 'rgb(0, 255, 0)';
			curveCtx.beginPath();
			curveCtx.moveTo(0, 0);

			this.prevCurvePoints.forEach((yVal: number, index: number) => {
				const adjustedYVal: number = curveHeight * yVal / drawOptions.curveYScale;
				curveCtx.lineTo(index * drawOptions.curveXScale, curveHeight - (adjustedYVal));
			});

			curveCtx.stroke();

			curveCtx.strokeStyle = 'rgba(0, 0, 255, 0.1)';
			curveCtx.beginPath();
			dtw.getPath().forEach((indices: [number, number]) => {
				curveCtx.moveTo(indices[0] * drawOptions.curveXScale, curveHeight - curveHeight * this.curvePoints[indices[0]] / drawOptions.curveYScale);
				curveCtx.lineTo(indices[1] * drawOptions.curveXScale, curveHeight -  curveHeight * this.prevCurvePoints[indices[1]] / drawOptions.curveYScale)
			});

			curveCtx.stroke();

			curveCtx.fillStyle = 'rgb(0, 0, 255)';
			curveCtx.font = '48px serif';
			//curveCtx.fillText(`${dtw.getDistance()}`, curveWidth - 300, 50);
		}*/
	}
}

export { Audio };