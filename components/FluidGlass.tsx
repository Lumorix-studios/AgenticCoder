/* eslint-disable react/no-unknown-property */
import * as THREE from 'three';
import { useRef, useState, useEffect, useMemo, memo, } from 'react';
import type { ReactNode } from 'react';
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber';
import type {ThreeElements} from '@react-three/fiber'
import {
  useFBO,
  useScroll,
  Image,
  Scroll,
  Preload,
  ScrollControls,
  Text
} from '@react-three/drei';
import { easing } from 'maath';

type Mode = 'lens' | 'bar' | 'cube';

interface NavItem {
  label: string;
  link: string;
}

type ModeProps = Record<string, unknown>;

interface FluidGlassProps {
  mode?: Mode;
  lensProps?: ModeProps;
  barProps?: ModeProps;
  cubeProps?: ModeProps;
  standalone?: boolean;
  /** Button labels to render inside the FBO scene so the glass has real text to refract */
  labels?: string[];
  /** Screen-space position (in pixels) to position the glass at. If not provided, follows the pointer. */
  targetPosition?: { x: number; y: number } | null;
}

/** A pill-shaped chip rendered in the FBO (no font dependency) */
function GlassChip({ color = '#22d3ee' }: { color?: string }) {
  return (
    <group>
      <mesh>
        <planeGeometry args={[0.2, 0.035]} />
        <meshBasicMaterial color="#3f3f46" transparent opacity={0.9} />
      </mesh>
      <mesh position={[-0.075, 0, 0.001]}>
        <planeGeometry args={[0.035, 0.014]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0.02, 0, 0.001]}>
        <planeGeometry args={[0.1, 0.006]} />
        <meshBasicMaterial color="#71717a" />
      </mesh>
    </group>
  );
}

/** Renders nav button chips in the FBO scene, top-left, matching the real HTML buttons */
function NavBarChips({ labels }: { labels: string[] }) {
  const groupRef = useRef<THREE.Group>(null!);
  const { viewport, camera } = useThree();

  useFrame(() => {
    const v = viewport.getCurrentViewport(camera, [0, 0, 15]);
    if (!groupRef.current) return;
    groupRef.current.position.set(-v.width / 2 + 0.08, v.height / 2 - 0.05, 15);
    groupRef.current.children.forEach((child, i) => {
      child.position.x = i * 0.22;
    });
  });

  return (
    <group ref={groupRef}>
      {labels.map((label, i) => (
        <GlassChip key={label} color={i === 1 ? '#a78bfa' : i === 2 ? '#f472b6' : '#22d3ee'} />
      ))}
    </group>
  );
}

export default function FluidGlass({
  mode = 'lens',
  lensProps = {},
  barProps = {},
  cubeProps = {},
  standalone = false,
  labels = [],
  targetPosition = null,
}: FluidGlassProps) {
  const Wrapper = mode === 'bar' ? Bar : mode === 'cube' ? Cube : Lens;
  const rawOverrides = mode === 'bar' ? barProps : mode === 'cube' ? cubeProps : lensProps;

  const {
    navItems = [
      { label: 'Home', link: '' },
      { label: 'About', link: '' },
      { label: 'Contact', link: '' }
    ],
    ...modeProps
  } = rawOverrides;

  if (standalone) {
    return (
      <Canvas
        camera={{ position: [0, 0, 20], fov: 15 }}
        gl={{ alpha: true, antialias: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <Wrapper modeProps={modeProps} hideBackdrop targetPosition={targetPosition}>
          {/* Bright-ish bg gives the glass contrast; chips give it something to refract */}
          <mesh position={[0, 0, -2]} scale={[100, 100, 1]}>
            <planeGeometry />
            <meshBasicMaterial color="#3f3f46" />
          </mesh>
          {/* decorative color blobs for refraction */}
          <mesh position={[-0.5, 0.9, -1]} scale={0.12}>
            <sphereGeometry args={[1, 32, 32]} />
            <meshBasicMaterial color="#22d3ee" />
          </mesh>
          <mesh position={[0.6, 0.7, -1]} scale={0.08}>
            <sphereGeometry args={[1, 32, 32]} />
            <meshBasicMaterial color="#a78bfa" />
          </mesh>
          <mesh position={[0, -0.8, -1]} scale={0.1}>
            <sphereGeometry args={[1, 32, 32]} />
            <meshBasicMaterial color="#f472b6" />
          </mesh>
          {labels.length > 0 && <NavBarChips labels={labels} />}
        </Wrapper>
        <Preload />
      </Canvas>
    );
  }

  return (
    <Canvas camera={{ position: [0, 0, 20], fov: 15 }} gl={{ alpha: true }}>
      <ScrollControls damping={0.2} pages={3} distance={0.4}>
        {mode === 'bar' && <NavItems items={navItems as NavItem[]} />}
        <Wrapper modeProps={modeProps} targetPosition={targetPosition}>
          <Scroll>
            <Typography />
            <Images />
          </Scroll>
          <Scroll html />
          <Preload />
        </Wrapper>
      </ScrollControls>
    </Canvas>
  );
}

type MeshProps = ThreeElements['mesh'];

interface ModeWrapperProps extends MeshProps {
  children?: ReactNode;
  /** Shape of the glass geometry: 'lens' | 'cube' | 'bar' */
  shape: 'lens' | 'cube' | 'bar';
  lockToBottom?: boolean;
  lockToTop?: boolean;
  followPointer?: boolean;
  modeProps?: ModeProps;
  /** Hide the full-screen FBO backdrop plane (use for UI overlays so it doesn't cover the app) */
  hideBackdrop?: boolean;
  /** Screen-space position (in pixels) to position the glass at. Overrides followPointer. */
  targetPosition?: { x: number; y: number } | null;
}

interface ZoomMaterial extends THREE.Material { zoom: number; }
interface ZoomMesh extends THREE.Mesh<THREE.BufferGeometry, ZoomMaterial> {}
type ZoomGroup = THREE.Group & { children: ZoomMesh[] };

const ModeWrapper = memo(function ModeWrapper({
  children,
  shape,
  lockToBottom = false,
  lockToTop = false,
  followPointer = true,
  modeProps = {},
  hideBackdrop = false,
  targetPosition = null,
  ...props
}: ModeWrapperProps) {
  const ref = useRef<THREE.Mesh>(null!);
  const rimRef = useRef<THREE.Mesh>(null!);
  const buffer = useFBO();
  const { viewport: vp } = useThree();
  const [scene] = useState<THREE.Scene>(() => new THREE.Scene());
  const geoWidthRef = useRef<number>(1);

  // Procedural geometry — no GLB loading, always renders (WebGL1 compatible)
  const geometry = useMemo(() => {
    if (shape === 'lens') return new THREE.CylinderGeometry(1, 1, 0.4, 64);
    if (shape === 'bar') return new THREE.BoxGeometry(1, 1, 1);
    return new THREE.BoxGeometry(1, 1, 1);
  }, [shape]);

  // Slightly larger rim for the glass edge highlight
  const rimGeometry = useMemo(() => {
    if (shape === 'lens') return new THREE.CylinderGeometry(1.06, 1.06, 0.35, 64, 1, true);
    return new THREE.BoxGeometry(1.06, 1.06, 1.06);
  }, [shape]);

  useEffect(() => {
    geometry.computeBoundingBox();
    geoWidthRef.current = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x || 1;
  }, [geometry]);

  useFrame((state, delta) => {
    const { gl, viewport, pointer, camera } = state;
    const v = viewport.getCurrentViewport(camera, [0, 0, 15]);

    let destX: number;
    let destY: number;

    if (targetPosition) {
      // Convert screen coordinates to 3D coordinates at z=15
      const ndcX = (targetPosition.x / window.innerWidth) * 2 - 1;
      const ndcY = -(targetPosition.y / window.innerHeight) * 2 + 1;
      destX = ndcX * (v.width / 2);
      destY = ndcY * (v.height / 2);
    } else if (followPointer) {
      destX = (pointer.x * v.width) / 2;
      destY = (pointer.y * v.height) / 2;
    } else {
      destX = 0;
      destY = lockToTop ? v.height / 2 - 0.2 : lockToBottom ? -v.height / 2 + 0.2 : 0;
    }

    if (ref.current) {
      easing.damp3(ref.current.position, [destX, destY, 15], 0.15, delta);
      if (rimRef.current) {
        rimRef.current.position.copy(ref.current.position);
        rimRef.current.position.z = 14.9;
      }
    }

    if (ref.current && (modeProps as { scale?: number }).scale == null) {
      const maxWorld = v.width * 0.9;
      ref.current.scale.setScalar(Math.min(0.15, maxWorld / geoWidthRef.current));
      if (rimRef.current) rimRef.current.scale.copy(ref.current.scale);
    }

    // Render the internal scene to FBO (this is what the glass displays)
    gl.setRenderTarget(buffer);
    gl.setClearColor(0x27272a, 1); // opaque dark gray so the glass always has content
    gl.clear();
    gl.render(scene, camera);

    // Restore main canvas to transparent so your app UI shows through
    gl.setRenderTarget(null);
    gl.setClearColor(0x000000, 0);
  });

  const { scale, ior, thickness, anisotropy, chromaticAberration, ...extraMat } = modeProps as {
    scale?: number;
    ior?: number;
    thickness?: number;
    anisotropy?: number;
    chromaticAberration?: number;
    [key: string]: unknown;
  };

  return (
    <>
      {createPortal(children, scene)}

      {/* Full-screen backdrop — shows FBO content behind the glass in the original demo.
          Hidden in standalone/overlay mode so it doesn't paint over the real UI. */}
      {!hideBackdrop && (
        <mesh scale={[vp.width, vp.height, 1]}>
          <planeGeometry />
          <meshBasicMaterial map={buffer.texture} transparent />
        </mesh>
      )}

      {/* Glass rim — a subtle colored edge defining the lens shape */}
      <mesh
        ref={rimRef}
        scale={scale ?? 0.15}
        rotation-x={Math.PI / 2}
        geometry={rimGeometry}
        renderOrder={2}
      >
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* The glass lens mesh — maps the FBO texture for a guaranteed-visible glass effect */}
      <mesh
        ref={ref}
        scale={scale ?? 0.15}
        rotation-x={Math.PI / 2}
        geometry={geometry}
        renderOrder={1}
        {...props}
      >
        <meshBasicMaterial
          map={buffer.texture}
          transparent
          opacity={0.75}
          side={THREE.DoubleSide}
          toneMapped={false}
          {...(typeof extraMat === 'object' && extraMat !== null ? extraMat : {})}
        />
      </mesh>
    </>
  );
});

function Lens({ modeProps, hideBackdrop, targetPosition, ...p }: { modeProps?: ModeProps; hideBackdrop?: boolean; targetPosition?: { x: number; y: number } | null } & MeshProps) {
  return <ModeWrapper shape="lens" followPointer modeProps={modeProps} hideBackdrop={hideBackdrop} targetPosition={targetPosition} {...p} />;
}

function Cube({ modeProps, hideBackdrop, targetPosition, ...p }: { modeProps?: ModeProps; hideBackdrop?: boolean; targetPosition?: { x: number; y: number } | null } & MeshProps) {
  return <ModeWrapper shape="cube" followPointer modeProps={modeProps} hideBackdrop={hideBackdrop} targetPosition={targetPosition} {...p} />;
}

function Bar({ modeProps = {}, hideBackdrop, targetPosition, ...p }: { modeProps?: ModeProps; hideBackdrop?: boolean; targetPosition?: { x: number; y: number } | null } & MeshProps) {
  const defaultMat = {
    transmission: 1, roughness: 0, thickness: 10, ior: 1.15,
    color: '#ffffff', attenuationColor: '#ffffff', attenuationDistance: 0.25
  };
  return (
    <ModeWrapper
      shape="bar"
      lockToTop
      followPointer={false}
      modeProps={{ ...defaultMat, ...modeProps }}
      hideBackdrop={hideBackdrop}
      targetPosition={targetPosition}
      {...p}
    />
  );
}

function NavItems({ items }: { items: NavItem[] }) {
  const group = useRef<THREE.Group>(null!);
  const { viewport, camera } = useThree();
  const DEVICE = {
    mobile:  { max: 639,      spacing: 0.2,  fontSize: 0.035 },
    tablet:  { max: 1023,     spacing: 0.24, fontSize: 0.045 },
    desktop: { max: Infinity, spacing: 0.3,  fontSize: 0.045 },
  };
  const getDevice = () => {
    const w = window.innerWidth;
    return w <= DEVICE.mobile.max ? 'mobile' : w <= DEVICE.tablet.max ? 'tablet' : 'desktop';
  };
  const [device, setDevice] = useState<keyof typeof DEVICE>(getDevice());
  useEffect(() => {
    const onResize = () => setDevice(getDevice());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const { spacing, fontSize } = DEVICE[device];
  useFrame(() => {
    if (!group.current) return;
    const v = viewport.getCurrentViewport(camera, [0, 0, 15]);
    group.current.position.set(0, -v.height / 2 + 0.2, 15.1);
    group.current.children.forEach((child, i) => {
      child.position.x = (i - (items.length - 1) / 2) * spacing;
    });
  });
  const handleNavigate = (link: string) => {
    if (!link) return;
    link.startsWith('#') ? (window.location.hash = link) : (window.location.href = link);
  };
  return (
    <group ref={group} renderOrder={10}>
      {items.map(({ label, link }) => (
        <Text key={label} fontSize={fontSize} color="white" anchorX="center" anchorY="middle"
          outlineWidth={0} outlineBlur="20%" outlineColor="#000" outlineOpacity={0.5} renderOrder={10}
          onClick={e => { e.stopPropagation(); handleNavigate(link); }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'auto')}
        >
          {label}
        </Text>
      ))}
    </group>
  );
}

function Images() {
  const group = useRef<ZoomGroup>(null!);
  const data = useScroll();
  const { height } = useThree(s => s.viewport);
  useFrame(() => {
    group.current.children[0].material.zoom = 1 + data.range(0, 1 / 3) / 3;
    group.current.children[1].material.zoom = 1 + data.range(0, 1 / 3) / 3;
    group.current.children[2].material.zoom = 1 + data.range(1.15 / 3, 1 / 3) / 2;
    group.current.children[3].material.zoom = 1 + data.range(1.15 / 3, 1 / 3) / 2;
    group.current.children[4].material.zoom = 1 + data.range(1.15 / 3, 1 / 3) / 2;
  });
  return (
    <group ref={group}>
      <Image position={[-2, 0, 0]}          scale={[3, height / 1.1]} url="/assets/demo/cs1.webp" />
      <Image position={[2, 0, 3]}            scale={3}                 url="/assets/demo/cs2.webp" />
      <Image position={[-2.05, -height, 6]}  scale={[1, 3]}            url="/assets/demo/cs3.webp" />
      <Image position={[-0.6, -height, 9]}   scale={[1, 2]}            url="/assets/demo/cs1.webp" />
      <Image position={[0.75, -height, 10.5]} scale={1.5}              url="/assets/demo/cs2.webp" />
    </group>
  );
}

function Typography() {
  const DEVICE = { mobile: { fontSize: 0.2 }, tablet: { fontSize: 0.4 }, desktop: { fontSize: 0.6 } };
  const getDevice = () => { const w = window.innerWidth; return w <= 639 ? 'mobile' : w <= 1023 ? 'tablet' : 'desktop'; };
  const [device, setDevice] = useState<keyof typeof DEVICE>(getDevice());
  useEffect(() => {
    const onResize = () => setDevice(getDevice());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return (
    <Text position={[0, 0, 12]} fontSize={DEVICE[device].fontSize} letterSpacing={-0.05}
      outlineWidth={0} outlineBlur="20%" outlineColor="#000" outlineOpacity={0.5}
      color="white" anchorX="center" anchorY="middle"
    >
      React Bits
    </Text>
  );
}