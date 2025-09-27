import Hero from './components/Hero';
import { Navbar } from './components/Navbar';
import { SwapWidget } from './components/SwapWidget';
function App() {
  return (
    <div className="min-h-screen">
      {/* <Navbar /> */}
      <Hero />
      <div className='py-48'>
      <SwapWidget/>
      </div>
    </div>
  );
}

export default App;
