const analyserOptions = {
	fftSize: 32768, // 32768 max
	smoothingTimeConstant: 0.25 //0.5
}

const streamOptions = {
	video: false,
	audio: true
}

const pitch = {
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
	interval: NodeJS.Timer | null;
	analyser: AnalyserNode | null;
	canvas: HTMLCanvasElement | null;
	enabled: boolean = false;
	sampleRate: number = 0;
	fundamentalFreq: number = 0;

    constructor(canvas: HTMLCanvasElement) {
		this.data = null;
		this.interval = null;
		this.analyser = null;
		this.canvas = canvas;

		this.init();
    }

	async init(): Promise<void> {
		await this.initAnalyser();
		this.initInterval(100);
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
		if (this.canvas) {
			try {
				const canvasCtx: CanvasRenderingContext2D = this.canvas.getContext("2d")!;
				const WIDTH: number = this.canvas.width;
				const HEIGHT: number = this.canvas.height;
				const bufferLength: number = this.analyser!.frequencyBinCount;
	
				canvasCtx.fillStyle = 'rgb(0, 0, 0)';
				canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
	
				const barWidth = (WIDTH / bufferLength) * 2.5;
				let max_val = -Infinity;
				let max_index = -1;
				let x = 0;
				for(let i = 0; i < bufferLength; i++) {
					let barHeight = this.data![i];
					if (barHeight > 100 && barHeight > max_val) {
						max_val = barHeight;
						max_index = i;
					}

					canvasCtx.fillStyle = 'rgb(' + (barHeight+100) + ',50,50)';

					canvasCtx.fillRect(x,HEIGHT-barHeight/2,barWidth,barHeight);
					x += barWidth;
				}

				canvasCtx.strokeStyle = 'rgb(0, 255, 0)';
				canvasCtx.strokeRect(0, HEIGHT-(max_val/2), WIDTH, 1);

				canvasCtx.strokeStyle = 'rgb(255, 255, 0)';
				canvasCtx.strokeRect(max_index * barWidth, 0, 1, HEIGHT);
				
				this.fundamentalFreq = this.sampleRate * max_index / analyserOptions.fftSize;
				canvasCtx.fillStyle = 'rgb(0, 0, 255)';
				canvasCtx.font = '48px serif';
  				canvasCtx.fillText(this.findNearestPitch(this.fundamentalFreq), WIDTH - 75, 50);
			} catch (err) {
				console.error(`Failed to draw! ${this.fundamentalFreq}`, err);
			}
		}
	}
}

export { Audio };