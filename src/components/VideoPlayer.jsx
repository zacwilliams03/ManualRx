export default function VideoPlayer({ url, className = 'w-full rounded' }) {
  if (!url) return null
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be')
  if (isYouTube) {
    let embedUrl = url
    if (url.includes('watch?v=')) {
      const videoId = new URL(url).searchParams.get('v')
      embedUrl = `https://www.youtube.com/embed/${videoId}`
    } else if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1].split('?')[0]
      embedUrl = `https://www.youtube.com/embed/${videoId}`
    }
    return (
      <iframe
        src={embedUrl}
        className={className}
        style={{ aspectRatio: '16/9' }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Exercise video"
      />
    )
  }
  return <video src={url} controls className={className} style={{ aspectRatio: '16/9' }} />
}
