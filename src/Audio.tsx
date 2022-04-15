import DynamicTimeWarping from "dynamic-time-warping-ts"; 
import { BGMs } from "./constants/BGMs";
import React from "react";
import { findNearestPitch } from "./helpers/freqToPitch";
import { v4 as uuid } from "uuid";
import { Button, Col, Container, Modal, ModalBody, ModalHeader, Row, Table } from "reactstrap";

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
	modalIsOpen: boolean;
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
			lastGuessed: "",
			modalIsOpen: false
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
				<Modal
					isOpen={this.state.modalIsOpen}
				>
					<ModalHeader
						toggle={() => { this.setState({modalIsOpen: false}) }}
					>
						How to use
					</ModalHeader>
					<ModalBody>
						<p>
							1. Make sure game audio is on and is feeding into some sort of interpretable input such as:
							<ul>
								<li>Enabling stereo mix</li>
								<li>Isolating the audio into its own virtual input via programs like VoiceMeeter</li>
								<li>Having loud enough speaker to be picked up by your microphone</li>
							</ul>
						</p>

						<p>2. Press "Start" and give your browser access to listen to the microphone / virtual input containing the game audio. You'll know if it's listening properly if you see waveforms from any sounds it hears.</p>

						<p>3. Go back into the game and make sure the song is playing.</p>

						<p>4. The right-side table will list the guesses for what BGM is playing in order of its confidence level.</p>

						<hr />

						<p>This tool should work at any point in any of the BGM's runtime with varying degrees of success</p>

						<p>It also surprisingly works decently through the speaker + microphone input method, you just need to be a little quiet while it listens...</p>

						<p>Do note that this tool is not perfect and should mainly be used as an assistant tool to narrow it down for you. However, from my tests, if it does not guess it correctly within the first 5 seconds, it will eventually get it after 20 or so seconds.</p>
					</ModalBody>
				</Modal>
				<Container fluid>
					<Row>
						<Col
							style={{
								textAlign: "center"
							}}
						>
							<Row
								style={{
									width: "1000px",
									position: "relative",
									left: "50%",
									msTransform: "translate(-50%, 0)",
  									transform: "translate(-50%, 0)",
									display: "flex",
									flexDirection: "row"
								}}
							>
								<Button
									style={{
										width: "50px",
										display: "flex",
										margin: "15px 25px 15px 25px",
										padding: "10px 0px 10px 0px",
										justifyContent: "center"
									}}
									onClick={() => { this.setState({modalIsOpen: true}) }}
								>
									?
								</Button>
								<Button
									style={{
										display: "flex",
										margin: "15px 0px 15px 0px",
										padding: "10px 0px 10px 0px",
										justifyContent: "center",
										width: "auto",
										flexGrow: "1"
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
							</Row>
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