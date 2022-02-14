import React from "react";
import { Audio } from "./Audio";

class App extends React.Component {
	render(): JSX.Element {
		return (
			<React.Fragment>
				<Audio />
			</React.Fragment>
		);
	}
}

export { App };