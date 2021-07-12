import * as React from "react";

export class ErrorBoundary extends React.Component<{}, { error: any }> {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: any) {
    // Update state so the next render will show the fallback UI.
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    //console.error(error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div id="errorBoundrary">
          <h1>Something went wrong.</h1>
          <p>{"" + this.state.error}</p>
          <button id="btnRetry" onClick={()=>this.setState({error: null})}>Retry</button>
        </div>
      );
    }

    return this.props.children;
  }
}
