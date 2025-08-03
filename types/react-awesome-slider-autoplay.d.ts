declare module "react-awesome-slider/dist/autoplay" {
    import AwesomeSlider, { AwesomeSliderProps } from "react-awesome-slider";

    interface AutoplayProps extends AwesomeSliderProps {
        play?: boolean;
        cancelOnInteraction?: boolean;
        interval?: number;
    }

    export default function withAutoplay(
        slider: typeof AwesomeSlider
    ): React.ComponentClass<AutoplayProps>;
}
