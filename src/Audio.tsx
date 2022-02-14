import DynamicTimeWarping from "dynamic-time-warping-ts"; 
import { BGMs } from "./constants/BGMs";
import React from "react";
import { findNearestPitch } from "./helpers/freqToPitch";
import { v4 as uuid } from "uuid";
import { Button, Col, Container, Row, Table } from "reactstrap";

const analyserOptions = {
	fftSize: 32768, // 32768 max
	smoothingTimeConstant: 0.25, //0.5,
	intervalSpeed: 100,
	minSearchSize: 0, // In seconds
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

interface IAudioState {
	graphRef: React.RefObject<HTMLCanvasElement>;
	curveRef: React.RefObject<HTMLCanvasElement>;
	curvePoints: number[];
	enabled: boolean;
	sampleRate: number;
	guesses: { [key: string]: number };
	lastGuessed: string;
	graph?: HTMLCanvasElement;
	curve?: HTMLCanvasElement;
	data?: Uint8Array | null;
	interval?: NodeJS.Timer;
	analyser?: AnalyserNode;
};

class Audio extends React.Component<any, IAudioState> {
    constructor(props: any) {
		super(props);

		this.state = {
			graphRef: React.createRef<HTMLCanvasElement>(),
			curveRef: React.createRef<HTMLCanvasElement>(),
			curvePoints: [],
			enabled: false,
			sampleRate: 0,
			guesses: {},
			lastGuessed: ""
		};

		this.toggleEnable = this.toggleEnable.bind(this);
		this.initAnalyser = this.initAnalyser.bind(this);
		this.initInterval = this.initInterval.bind(this);
		this.drawToCanvas = this.drawToCanvas.bind(this);
    }

	async componentDidMount(): Promise<void> {
		this.setState({
			graph: this.state.graphRef.current!,
			curve: this.state.curveRef.current!
		});
	}

	public toggleEnable(): void {
		if (!this.state.enabled) {
			this.setState({
				curvePoints: [],
				guesses: {}
			});
		}

		this.setState({ enabled: !this.state.enabled });
	}

    private async initAnalyser(): Promise<void> {
		if (navigator.mediaDevices.getUserMedia !== null) {
			try {
				const audioCtx: AudioContext = new AudioContext();
				const analyser: AnalyserNode = audioCtx.createAnalyser();

				analyser.fftSize = analyserOptions.fftSize;
				analyser.smoothingTimeConstant = analyserOptions.smoothingTimeConstant;
				audioCtx.createMediaStreamSource(await navigator.mediaDevices.getUserMedia(streamOptions)).connect(analyser);

				const sampleRate: number = audioCtx.sampleRate;
				const data: Uint8Array = new Uint8Array(analyser.frequencyBinCount);

				this.setState({
					analyser,
					sampleRate,
					data
				});
			} catch (err) {
				console.error("Failed to initialize analyser!", err);
			}
		}
	}

	private initInterval(): void {
		if (this.state.data === null || this.state.analyser === null) {
			console.error("Variables have not been initialized");
			return;
		}

		this.setState({
			interval: setInterval(() => {
				if (this.state.enabled) {
					this.state.analyser!.getByteFrequencyData(this.state.data!);
					this.drawToCanvas();
				}
			}, analyserOptions.intervalSpeed)
		});
	}

	private drawToCanvas(): void {
		if (!this.state.data || !this.state.graph || !this.state.curve) {
			return;
		}

		const bufferLength: number = this.state.analyser!.frequencyBinCount;
		const graphCtx: CanvasRenderingContext2D = this.state.graph.getContext("2d")!;
		const curveCtx: CanvasRenderingContext2D = this.state.curve.getContext("2d")!;
		const graphWidth: number = this.state.graph.width;
		const graphHeight: number = this.state.graph.height;
		const curveWidth: number = this.state.curve.width;
		const curveHeight: number = this.state.curve.height;
		const barWidth: number = (graphWidth / bufferLength) * 2.5;
		const newGuesses: { [key: string]: number } = {...this.state.guesses};
		let newCurvePoints: number[] = [...this.state.curvePoints];
		let max_val: number = -Infinity;
		let max_index: number = -1;

		/* Draw some graph stuff */
		graphCtx.fillStyle = 'rgb(0, 0, 0)';
		graphCtx.fillRect(0, 0, graphWidth, graphHeight);

		this.state.data.forEach((barHeight: number, index: number) => {
			if (barHeight > 100 && barHeight < 1100 && barHeight > max_val) {
				max_val = barHeight;
				max_index = index;
			}

			graphCtx.fillStyle = 'rgb(' + (barHeight + 100) + ', 50, 50)';
			graphCtx.fillRect(index * barWidth, graphHeight - (barHeight / 2), barWidth, barHeight);
		});

		const fundamentalFreq: number = this.state.sampleRate * (max_index / analyserOptions.fftSize);
		const foundPitch: string = findNearestPitch(fundamentalFreq);

		graphCtx.strokeStyle = 'rgb(0, 255, 0)';
		graphCtx.strokeRect(0, graphHeight - (max_val / 2), graphWidth, 1);

		graphCtx.strokeStyle = 'rgb(255, 255, 0)';
		graphCtx.strokeRect(max_index * barWidth, 0, 1, graphHeight);
		
		graphCtx.fillStyle = 'rgb(0, 0, 255)';
		graphCtx.font = '48px serif';
		graphCtx.fillText(foundPitch, graphWidth - 75, 50);

		/* Draw some curve stuff */
		if (newCurvePoints.length > (analyserOptions.maxSearchSize * 1000) / analyserOptions.intervalSpeed) {
			newCurvePoints = [];
		}

		newCurvePoints.push(fundamentalFreq);

		curveCtx.fillStyle = 'rgb(0, 0, 0)';
		curveCtx.fillRect(0, 0, curveWidth, curveHeight);

		curveCtx.strokeStyle = 'rgb(255, 255, 0)';
		curveCtx.beginPath();
		curveCtx.moveTo(0, curveHeight);

		newCurvePoints.forEach((yVal: number, index: number) => {
			curveCtx.lineTo(index * (curveWidth / ((analyserOptions.maxSearchSize * 1000) / analyserOptions.intervalSpeed)), curveHeight - (curveHeight * yVal / drawOptions.curveYScale));
		});

		curveCtx.stroke();

		if (newCurvePoints.length >= (analyserOptions.minSearchSize * 1000) / analyserOptions.intervalSpeed) {
			let bestMatch: number = Infinity;
			let bestMatchName: string = "";

			Object.entries(BGMs).forEach(([key, value]: [string, number[]]) => {
				const yVals: number[] = [...value];

				while (yVals.length) {
					const matchScore: number = new DynamicTimeWarping(newCurvePoints, yVals.splice(0, newCurvePoints.length), (a: number, b: number) => Math.abs(a - b)).getDistance();

					if (matchScore < bestMatch) {
						bestMatch = matchScore;
						bestMatchName = key;
					}
				}
			})

			newGuesses[bestMatchName] = (newGuesses[bestMatchName] || 0) + 1;

			this.setState({
				curvePoints: newCurvePoints,
				guesses: newGuesses,
				lastGuessed: bestMatchName
			});
		}
	}
	
	render(): JSX.Element {
		return (
			<React.Fragment>
				<Container fluid>
					<Row>
						<Col>
							<Button
								style={{
									position: "relative",
									left: "50%",
									msTransform: "translate(-50%, 0)",
  									transform: "translate(-50%, 0)",
									margin: "15px 0px 15px 0px",
									padding: "10px 50px 10px 50px",
									alignContent: "center"
								}}
								color={this.state.enabled ? "danger" : "success"}
								onClick={async () => {
									if (!this.state.analyser) {
										await this.initAnalyser();
										this.initInterval();
									}

									this.toggleEnable();
								}}
							>
								{this.state.enabled ? "Stop" : "Start"}
							</Button>
							<canvas 
								ref={this.state.graphRef}
								width={1000}
								height={250}
							/>
							<br />
							<canvas 
								ref={this.state.curveRef}
								width={1000}
								height={500}
							/>
						</Col>
						<Col>
							<Table hover>
								<thead>
									<tr>
										<th>Confidence</th>
										<th>BGM Name</th>
									</tr>
								</thead>
								<tbody>
									{Object.entries(this.state.guesses).sort((firstEl: [string, number], secondEl: [string, number]) => secondEl[1] - firstEl[1]).map(([key, value]: [string, number]) => {
										return (
											<tr 
												key={uuid()}
												style={{
													borderLeft: key === this.state.lastGuessed ? `5px solid green` : ""
												}}
											>
												<td>{(100 * value / Object.values(this.state.guesses).reduce((acc: number, val: number) => acc + val, 0)).toFixed(2)}%</td>
												<td>{key}</td>
											</tr>
										);
									})}
								</tbody>
							</Table>
						</Col>
					</Row>
					</Container>
			</React.Fragment>
		);
	}
}

export { Audio };