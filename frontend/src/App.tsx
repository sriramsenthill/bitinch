import Hero from './components/Hero';
import { Navbar } from './components/Navbar';

function App() {
  return (
    <div style={{
      background: `linear-gradient(${180}deg, #0c1638 30%, #e06038 100%)`,
    }}>
      <Navbar />
      <Hero />
    </div>
  );
}

export default App;
