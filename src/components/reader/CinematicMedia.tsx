import type { RenderedPage, RenderedStory } from '../../lib/types';
import { DemoScene } from '../../sample/scenes';

const motionClass: Record<string, string> = {
  'zoom-in': 'kb-zoom-in',
  'zoom-out': 'kb-zoom-out',
  'pan-left': 'kb-pan-left',
  'pan-right': 'kb-pan-right',
  drift: 'kb-drift',
};

/** The full-bleed animated backdrop for a page: video > image > vector scene. */
export function CinematicMedia({
  page,
  story,
  cover = false,
}: {
  page?: RenderedPage;
  story: RenderedStory;
  cover?: boolean;
}) {
  const motion = page?.motion ?? 'drift';
  const kb = motionClass[motion] ?? 'kb-drift';
  const sceneId = cover ? story.coverSceneId : page?.sceneId;
  const imageUrl = cover ? story.coverImageUrl : page?.imageUrl;
  const videoUrl = page?.videoUrl;

  return (
    <div className="cinema-media">
      {videoUrl ? (
        <video className={`cinema-layer ${kb}`} src={videoUrl} autoPlay loop muted playsInline />
      ) : imageUrl ? (
        <img className={`cinema-layer ${kb}`} src={imageUrl} alt="" />
      ) : sceneId ? (
        <div className={`cinema-layer cinema-scene ${kb}`}>
          <DemoScene sceneId={sceneId} />
        </div>
      ) : (
        <div className="cinema-layer cinema-fallback" />
      )}
      <div className="cinema-vignette" />
    </div>
  );
}
