"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Color,
    Group,
    Mesh,
    MeshPhysicalMaterial,
    Points,
    Vector3,
    PMREMGenerator,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { MotionValue } from "framer-motion";
import styles from "./luxury.module.css";

interface Props {
    progress: MotionValue<number>;
    active: boolean;
    compact: boolean;
}
/** スクロール進捗に応じた彫刻の水平位置。前半は右→左、後半は左→右へ流れる。compact 時は中央固定。 */
function sculptureX(p: number, compact: boolean): number {
    if (compact) return 0;
    return p < 0.5 ? 1.9 - p * 7 : -1.6 + (p - 0.5) * 7;
}
function Sculpture({ progress, compact }: Readonly<Omit<Props, "active">>) {
    const group = useRef<Group>(null);
    const gem = useRef<Mesh>(null);
    const material = useRef<MeshPhysicalMaterial>(null);
    const rings = useRef<Group>(null);
    const dust = useRef<Points>(null);
    const elapsed = useRef(0);
    const pointer = useRef({ x: 0, y: 0 });
    const { gl, scene } = useThree();
    useEffect(() => {
        const generator = new PMREMGenerator(gl);
        const room = new RoomEnvironment();
        const environment = generator.fromScene(room, 0.04);
        scene.environment = environment.texture;
        room.dispose();
        generator.dispose();
        return () => {
            scene.environment = null;
            environment.dispose();
        };
    }, [gl, scene]);
    useEffect(() => {
        if (compact) return;
        const move = (event: PointerEvent) => {
            pointer.current = {
                x: (event.clientX / innerWidth) * 2 - 1,
                y: -((event.clientY / innerHeight) * 2 - 1),
            };
        };
        window.addEventListener("pointermove", move, { passive: true });
        return () => window.removeEventListener("pointermove", move);
    }, [compact]);
    const emerald = useMemo(() => new Color("#12654c"), []);
    const gold = useMemo(() => new Color("#ab8040"), []);
    const target = useMemo(() => new Vector3(), []);
    const positions = useMemo(() => {
        const count = compact ? 45 : 110;
        const values = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            // Deterministic constellation, identical on every mount.
            values[i * 3] = Math.sin(i * 127.1) * 6;
            values[i * 3 + 1] = Math.cos(i * 311.7) * 4;
            values[i * 3 + 2] = Math.sin(i * 74.7) * 3 - 2;
        }
        return values;
    }, [compact]);
    useFrame(({ camera }, delta) => {
        elapsed.current += Math.min(delta, 0.05);
        const t = elapsed.current;
        const p = progress.get();
        const warmth = Math.max(0, (p - 0.45) / 0.55);
        if (group.current) {
            target.set(
                sculptureX(p, compact),
                Math.sin(t * 0.6) * 0.12,
                0
            );
            group.current.position.lerp(target, 0.045);
            group.current.rotation.y = t * 0.12 + p * Math.PI;
            group.current.rotation.z = -0.16 + Math.sin(t * 0.3) * 0.05;
        }
        if (gem.current) gem.current.rotation.y = t * 0.09;
        if (material.current)
            material.current.color.copy(emerald).lerp(gold, warmth);
        if (rings.current) {
            rings.current.rotation.z = t * 0.08 + p;
            rings.current.scale.setScalar(0.82 + p * 0.3);
        }
        if (dust.current) dust.current.rotation.y = t * 0.018;
        camera.position.x +=
            ((compact ? 0 : pointer.current.x * 0.18) - camera.position.x) *
            0.025;
        camera.position.y +=
            ((compact ? 0 : pointer.current.y * 0.12) - camera.position.y) *
            0.025;
        camera.lookAt(0, 0, 0);
    });
    return (
        <>
            <ambientLight intensity={0.7} />
            <directionalLight
                position={[2, 4, 4]}
                intensity={5}
                color="#fff3cf"
            />
            <directionalLight
                position={[-4, 1, 2]}
                intensity={3}
                color="#68bc99"
            />
            <pointLight position={[1, -3, 3]} intensity={16} color="#e0af57" />
            <group ref={group} scale={compact ? 0.85 : 1}>
                <mesh
                    ref={gem}
                    scale={[1.1, 1.5, 0.88]}
                    rotation={[0.18, 0.3, 0]}
                >
                    <icosahedronGeometry args={[1.15, 0]} />
                    <meshPhysicalMaterial
                        ref={material}
                        color="#12654c"
                        metalness={0.55}
                        roughness={0.17}
                        clearcoat={1}
                        clearcoatRoughness={0.08}
                        flatShading
                    />
                </mesh>
                <mesh scale={[1.102, 1.503, 0.882]} rotation={[0.18, 0.3, 0]}>
                    <icosahedronGeometry args={[1.15, 0]} />
                    <meshBasicMaterial
                        color="#c9d5a3"
                        wireframe
                        transparent
                        opacity={0.12}
                    />
                </mesh>
                <group ref={rings}>
                    <mesh rotation={[1.1, 0.3, 0.4]}>
                        <torusGeometry args={[2.05, 0.013, 8, 120]} />
                        <meshStandardMaterial
                            color="#d6bd83"
                            metalness={0.8}
                            roughness={0.25}
                        />
                    </mesh>
                    <mesh rotation={[0.45, 1.05, -0.4]}>
                        <torusGeometry args={[2.25, 0.007, 8, 120]} />
                        <meshStandardMaterial
                            color="#e5d1a1"
                            metalness={0.7}
                            roughness={0.3}
                        />
                    </mesh>
                    <mesh position={[1.97, 0.4, 0]}>
                        <octahedronGeometry args={[0.065]} />
                        <meshBasicMaterial color="#fff1c8" />
                    </mesh>
                </group>
            </group>
            <points ref={dust}>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        args={[positions, 3]}
                    />
                </bufferGeometry>
                <pointsMaterial
                    color="#dbc99a"
                    size={0.018}
                    transparent
                    opacity={0.7}
                    sizeAttenuation
                />
            </points>
        </>
    );
}
function ContextGuard({ onLost }: { onLost: () => void }) {
    const gl = useThree((state) => state.gl);
    useEffect(() => {
        const canvas = gl.domElement;
        canvas.addEventListener("webglcontextlost", onLost);
        return () => canvas.removeEventListener("webglcontextlost", onLost);
    }, [gl, onLost]);
    return null;
}
export default function Scene({ progress, active, compact }: Readonly<Props>) {
    const [lost, setLost] = useState(false);
    if (lost) return null;
    return (
        <div className={styles.canvas} data-testid="luxury-canvas">
            <Canvas
                frameloop={active ? "always" : "never"}
                dpr={compact ? 1 : [1, 1.5]}
                camera={{ position: [0, 0, 8], fov: 42 }}
                gl={{
                    antialias: !compact,
                    alpha: false,
                    powerPreference: "low-power",
                }}
                fallback={null}
            >
                <color attach="background" args={["#0b100e"]} />
                <ContextGuard onLost={() => setLost(true)} />
                <Sculpture progress={progress} compact={compact} />
            </Canvas>
        </div>
    );
}
