import CurvedLoop from '../ui/CurvedLoop';

export default function Hero() {
  const handleAnimationComplete = () => {
    console.log('All letters have animated!');
  };

  return (
    <div className="h-screen w-full flex flex-col">
      <div className="flex flex-col items-center text-center justify-center gap-8 mt-52">
        {/* <BlurText
          text="EXTEND 1INCH"
          delay={150}
          animateBy="letters"
          direction="top"
          onAnimationComplete={handleAnimationComplete}
          className="text-8xl font-black text-white mb-8"
        />
        <BlurText
          text="TO BITCOIN"
          delay={150}
          animateBy="letters"
          direction="top"
          onAnimationComplete={handleAnimationComplete}
          className="text-8xl font-black text-white"
        /> */}
      </div>

      <CurvedLoop 
        marqueeText="Extend 1inch to Bitcoin ✦"
        speed={3}
        curveAmount={400}
        direction="right"
        interactive={true}
      />
    </div>
  );
}