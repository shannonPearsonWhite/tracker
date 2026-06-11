const { useState, useEffect } = React;

function Clock() {
	const [now, setNow] = useState(new Date());
	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), 1000);
		return () => clearInterval(id);
	}, []);
	return (
		<div className="masthead-clock">
			<div className="masthead-clock-date">{now.toLocaleDateString()}</div>
			<div className="masthead-clock-time">{now.toLocaleTimeString()}</div>
		</div>
	);
}

function App() {
	return (
		<div>
			<header className="masthead">
				<div className="masthead-inner">
					<div>
						<div className="masthead-title">THE RECORD</div>
						<div className="masthead-sub">Political Accountability Tracker</div>
					</div>
					<div style={{flex:1}} />
					<Clock />
				</div>
			</header>

			<main className="main">
				<section>
					<h2>Welcome</h2>
					<p>The app is running. Add data and components in <strong>app.js</strong>.</p>
				</section>
			</main>
		</div>
	);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
































 











































































 









































































