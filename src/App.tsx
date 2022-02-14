import React from "react";
import { Audio } from "./Audio";

interface IAppState {
	audio: Audio | null;
	freqGraph: React.RefObject<HTMLCanvasElement>;
	freqCurve: React.RefObject<HTMLCanvasElement>;
};

class App extends React.Component<any, IAppState> {
	constructor(props: any) {
		super(props);

		this.state = {
			audio: null,
			freqGraph: React.createRef<HTMLCanvasElement>(),
			freqCurve: React.createRef<HTMLCanvasElement>()
		};
	}

	render(): JSX.Element {
		return (
			<React.Fragment>
				<button
					onClick={() => {
						if (!this.state.audio) {
							this.setState({
								audio: new Audio(this.state.freqGraph.current!, this.state.freqCurve.current!)
							})
						} else {
							this.state.audio.toggleEnable();
						}
					}}
				>
					Button
				</button>
				<br />
				<canvas 
					ref={this.state.freqGraph}
					width={1000}
					height={500}
				/>
				<br />
				<canvas 
					ref={this.state.freqCurve}
					width={1000}
					height={500}
				/>
			</React.Fragment>
		);
	}
}

export { App };