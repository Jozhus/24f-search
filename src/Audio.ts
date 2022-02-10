const fftSize: number = 32768; // 32768
const streamOptions = {
	video: false,
	audio: true
}

class Audio {
	data: Uint8Array | null;
	interval: NodeJS.Timer | null;
	analyser: AnalyserNode | null;
	canvas: HTMLCanvasElement | null;
	enabled: boolean = false;

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

    private async initAnalyser(): Promise<void> {
		if (navigator.mediaDevices.getUserMedia !== null) {
			try {
				const audioCtx: AudioContext = new AudioContext();
				this.analyser = audioCtx.createAnalyser();
				this.analyser.fftSize = fftSize;       
				audioCtx.createMediaStreamSource(await navigator.mediaDevices.getUserMedia(streamOptions)).connect(this.analyser);
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
					if(barHeight > max_val) {
						max_val = barHeight;
						max_index = i;
					}
	
					canvasCtx.fillStyle = 'rgb(' + (barHeight+100) + ',50,50)';
					canvasCtx.fillRect(x,HEIGHT-barHeight/2,barWidth,barHeight/2);
					x += barWidth;
				} 
			} catch (err) {
				console.error("Failed to draw!", err);
			}
		}
	}
}

export { Audio };