import {Composition, type CalculateMetadataFunction} from 'remotion';
import example from '../examples/space-explainer.json';
import {durationOf, videoPropsSchema, type VideoProps} from './project';
import {UniversalVideo} from './UniversalVideo';
import {MoonPhases, moonPhasesMetadata} from './MoonPhases';

const defaultProps = videoPropsSchema.parse(example);

const calculateMetadata: CalculateMetadataFunction<VideoProps> = ({props}) => {
  const validated = videoPropsSchema.parse(props);
  const {width, height, fps} = validated.project;
  return {width, height, fps, durationInFrames: durationOf(validated.project), props: validated};
};

export function Root() {
  return (
    <>
      <Composition
        id="UniversalVideo"
        component={UniversalVideo}
        schema={videoPropsSchema}
        defaultProps={defaultProps}
        calculateMetadata={calculateMetadata}
      />
      <Composition id="MoonPhases" component={MoonPhases} {...moonPhasesMetadata} />
    </>
  );
}