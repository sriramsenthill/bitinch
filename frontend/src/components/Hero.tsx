import Lottie from 'lottie-react';
import CurvedLoop from '../ui/CurvedLoop';
import animationData from '../../public/1inchLottie.json'
import animationData2 from '../../public/stripes.json'
import {ArrowRight} from 'lucide-react'
import { motion } from 'motion/react';

export default function Hero() {
  return (
    <div className="flex flex-col min-h-screen w-full relative items-center overflow-hidden">
      <div className="w-96 h-96 absolute top-[17%] left-[36%] z-10">
        <Lottie 
          animationData={animationData}
          loop={true}
          autoplay={true}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
      <div className="w-full h-full absolute top-[-80px] mr-32">
        <Lottie 
          animationData={animationData2}
          loop={true}
          autoplay={true}
          style={{ width: '110%', height: '120%' }}
        />
      </div>
      <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="px-4 flex gap-2 py-3 w-fit rounded-full text-xl text-amber-100 items-center absolute top-[500px] cursor-pointer bg-transparent backdrop-blur-xl shadow-2xl hover:bg-orange-950/40 z-20"
    >
      <span>Swap</span>
      <ArrowRight />
    </motion.div>
    <CurvedLoop 
      marqueeText="Routing where it all started ✦ Extending 1inch to Bitcoin ✦"
      speed={4}
      curveAmount={400}
      direction="left"
      interactive={true}
    />
    </div>
  );
}