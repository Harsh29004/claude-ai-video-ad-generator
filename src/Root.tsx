import {ALL_FORMATS, Input, UrlSource} from 'mediabunny';
import {Composition, staticFile, type CalculateMetadataFunction} from 'remotion';
import example from '../examples/space-explainer.json';
import {MoonPhases, moonPhasesMetadata} from './MoonPhases';
import {applyVoiceDurations, durationOf, videoPropsSchema, type Project, type VideoProps} from './project';
import {UniversalVideo} from './UniversalVideo';

const defaultProps = videoPropsSchema.parse(example);

async function audioSeconds(src: string): Promise<number> {
  const input = new Input({formats: ALL_FORMATS, source: new UrlSource(staticFile(src))});
  try {
    return await input.computeDuration();
  } finally {
    input.dispose();
  }
}

/** Measures every scene voiceover and lengthens any scene that would cut its line off. */
async function fitVoiceovers(project: Project): Promise<Project> {
  const measured: Record<string, number> = {};
  await Promise.all(project.scenes.map(async (scene) => {
    if (scene.voiceover && scene.voiceover.durationInFrames === undefined) {
      measured[scene.id] = Math.ceil((await audioSeconds(scene.voiceover.src)) * project.fps);
    }
  }));
  return applyVoiceDurations(project, measured);
}

const calculateMetadata: CalculateMetadataFunction<VideoProps> = async ({props}) => {
  const project = await fitVoiceovers(videoPropsSchema.parse(props).project);
  const {width, height, fps} = project;
  return {width, height, fps, durationInFrames: durationOf(project), props: {project}};
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
