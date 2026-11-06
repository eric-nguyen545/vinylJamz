import { Link } from 'react-router-dom'
import type { StoredAlbum } from '../lib/albumsRepo'
import { AlbumArtwork } from './AlbumArtwork'

export function AlbumCard({ album }: { album: StoredAlbum }) {
  return (
    <li>
      <Link to={`/collection/${album.id}`} className="group block">
        <AlbumArtwork url={album.artworkUrl} title={album.title} artist={album.primaryArtist} className="rounded-md ring-1 ring-groove transition group-hover:ring-label" />
        <p className="mt-2 truncate font-medium">{album.title}</p>
        <p className="truncate text-sm text-dust">
          {album.artistNames.join(', ')}{album.releaseYear ? `, ${album.releaseYear}` : ''}
        </p>
        {album.copyCount > 1 && <p className="text-xs text-label">{album.copyCount} copies</p>}
      </Link>
    </li>
  )
}

export function AlbumGrid({ albums }: { albums: StoredAlbum[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {albums.map((a) => <AlbumCard key={a.id} album={a} />)}
    </ul>
  )
}

export function AlbumTable({ albums }: { albums: StoredAlbum[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-groove">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Albums in your collection</caption>
        <thead className="bg-sleeve text-dust">
          <tr>
            <th scope="col" className="w-14 p-2"><span className="sr-only">Cover</span></th>
            <th scope="col" className="p-2">Album</th>
            <th scope="col" className="p-2">Artist</th>
            <th scope="col" className="p-2">Year</th>
            <th scope="col" className="p-2 text-right">Copies</th>
          </tr>
        </thead>
        <tbody>
          {albums.map((a) => (
            <tr key={a.id} className="border-t border-groove">
              <td className="p-2"><AlbumArtwork url={a.artworkUrl} title={a.title} artist={a.primaryArtist} className="w-10 rounded" /></td>
              <td className="p-2 font-medium"><Link to={`/collection/${a.id}`} className="underline-offset-4 hover:underline">{a.title}</Link></td>
              <td className="p-2 text-dust">{a.artistNames.join(', ')}</td>
              <td className="p-2 text-dust">{a.releaseYear ?? ''}</td>
              <td className="p-2 text-right">{a.copyCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
