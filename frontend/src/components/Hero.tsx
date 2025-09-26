import CurvedLoop from '../ui/CurvedLoop';

export default function Hero() {
  return (
    <div className="h-screen w-full flex flex-col">
      <CurvedLoop 
        marqueeText="Extending 1inch to Bitcoin ✦"
        speed={3}
        curveAmount={400}
        direction="right"
        interactive={true}
      />
    </div>
  );
}