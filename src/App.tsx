import React from "react";
import { Audio } from "./Audio";

interface IAppState {
	audio: Audio | null;
	canvas: React.RefObject<HTMLCanvasElement>;
};

class App extends React.Component<any, IAppState> {
	constructor(props: any) {
		super(props);

		this.state = {
			audio: null,
			canvas: React.createRef<HTMLCanvasElement>()
		};
	}

	render(): JSX.Element {
		return (
			<React.Fragment>
				<button
					onClick={() => {
						if (!this.state.audio) {
							this.setState({
								audio: new Audio(this.state.canvas.current!)
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
					ref={this.state.canvas}
					id={"cvs"}
					width={1000}
					height={500}
				/>
			</React.Fragment>
		);
	}
}

export { App };