/** @jsxImportSource sigl */
import $ from 'sigl'

import { IconSvg } from 'icon-svg'
import { SchedulerNode } from 'scheduler-node'
import { NumberInputElement } from 'sigl-ui'
import { dbToFloat } from 'webaudio-tools'

export type TransportableNode = { start: (time?: number) => void; stop: (time?: number) => void }

export const AudioTransportState = {
  Idle: 'idle',
  Playing: 'playing',
  Paused: 'paused',
  Stopped: 'stopped',
} as const

export interface AudioTransportElement extends $.Element<AudioTransportElement> {}

@$.element()
export class AudioTransportElement extends HTMLElement {
  NumberInput = $.element(NumberInputElement)

  @$.attr() state = $(this).state(AudioTransportState)

  audioContext = new AudioContext({ sampleRate: 44100, latencyHint: 0.03 })

  mainGain = $(this).reduce(({ audioContext }) => {
    const node = audioContext.createGain()
    node.connect(audioContext.destination)
    return node
  })

  analyserNode = $(this).reduce(({ audioContext, mainGain }) => {
    const node = new AnalyserNode(audioContext, {
      smoothingTimeConstant: 0,
      // Must be a power of 2 between 2^5 and 2^15, so one of: 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, and 32768.
      fftSize: 128,
      maxDecibels: 0,
      minDecibels: -100,
    })
    mainGain.connect(node)
    return node
  })

  analyserBuffer = $(this).reduce(({ analyserNode }) => new Float32Array(analyserNode.frequencyBinCount))

  clipThreshold = dbToFloat(-0.2)
  clipping = true
  clipLag = 3000
  lastClip = 0
  lastPeak = 0
  peak = 1
  peakLag = 1000
  peakVolume = 1

  schedulerNode = $(this).reduce(async ({ audioContext }) => SchedulerNode.create(audioContext))

  volume = 1
  bpm = 120

  startTime = 0
  pausedTime = 0

  setParam = (param: AudioParam, targetValue: number, slope = 0.015) => {
    param.setTargetAtTime(targetValue, this.audioContext.currentTime, slope)
  }

  play = $(this).with(({ start }) => (() => {
    // TODO: if paused offset time on every node
    //  if stopped offset to 0
    start()
  }))

  playOrPause = $(this).with(({ $, play, pause }) => (() => {
    if ($.state.is(AudioTransportState.Playing)) {
      pause()
    } else {
      play()
    }
  }))

  pause = $(this).with(({ $, audioContext, startTime, stop }) => (() => {
    // TODO: fix pause/stop time offsets
    $.pausedTime = audioContext.currentTime - startTime
    stop()
    $.state.swap(AudioTransportState.Paused)
  }))

  start = $(this).with(({ $, schedulerNode }) => (async () => {
    if ($.state.isIdle) {
      $.state.push(AudioTransportState.Playing)
    } else {
      $.state.swap(AudioTransportState.Playing)
    }
    $.startTime = await schedulerNode.start()
  }))

  stop = $(this).with(({ $, schedulerNode }) => (() => {
    schedulerNode.stop()
    $.state.swap(AudioTransportState.Stopped)
  }))

  PlayPauseStop?: () => JSX.Element
  Time?: () => JSX.Element
  Bpm?: () => JSX.Element
  Logo?: () => JSX.Element

  bar?: HTMLSpanElement
  beat?: HTMLSpanElement
  sixt?: HTMLSpanElement

  vu?: HTMLElement
  gradientCanvas = Object.assign(document.createElement('canvas'), { width: 100, height: 1 })
  gradientCanvasCtx = this.gradientCanvas.getContext('2d')!
  gradient = (() => {
    const ctx = this.gradientCanvasCtx
    const g = ctx.createLinearGradient(0, 0, 100, 0)
    g.addColorStop(0, '#5f5')
    g.addColorStop(0.4, '#5f5')
    g.addColorStop(0.8, '#ff5')
    g.addColorStop(1, '#f11')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 100, 1)
    return g
  })()

  mounted($: AudioTransportElement['$']) {
    $.Logo = $.part(() => (
      <div class="logo">
        <svg viewBox="0 0 32 32">
          <path
            d="m26.144 0.864s1.28 2.528 0.64 3.36c-1.12 1.536-5.6 1.536-5.6 1.536l1.984 2.944s5.888-1.024 6.848-3.008c0.864-1.824-3.872-4.8-3.872-4.8zm-20.096 0.192s-4.768 0.608-4.416 4.16c0.32 3.296 7.808 3.744 7.808 3.744 0.576-1.056 1.216-2.368 2.016-3.424 0 0-5.728 0.576-6.464-1.44-0.8-2.112 1.056-3.072 1.056-3.072zm10.24 4.096c-1.152 0-2.272-0.768-3.36-0.448-2.624 3.424-4.352 7.68-6.048 11.584 2.144 3.328 3.616 5.6 3.648 8.448 0 0-2.656 2.848-2.4 4.32 0.352 1.888 3.456 3.456 3.456 3.456 2.912 0.32 5.824 0.672 9.216 0.064 0 0 3.04-2.176 3.04-3.424 0.032-1.568-2.368-4.416-2.368-4.416 0.32-2.816 2.624-5.344 4.256-8.128-1.056-3.776-2.88-8-5.92-11.712-1.216-0.512-2.4 0.256-3.552 0.256zm11.392 3.616c-1.824 0-4.032 0.928-4.032 0.928 1.696 3.136 1.504 3.232 3.584 4.48s4.768 0.352 4.768 0.352-0.928-4.16-2.752-5.376c-0.416-0.288-0.96-0.384-1.568-0.384zm-23.104 0.128c-0.512 0-0.992 0.064-1.44 0.256-1.856 0.896-3.136 6.08-3.136 6.08s3.84 0.448 5.376-0.448c1.6-0.96 3.584-4.64 3.584-4.64-1.248-0.512-2.88-1.248-4.384-1.248zm5.984 6.272s1.44-0.32 2.592 0.352c0.704 0.416 0.416 2.144 0.416 2.144s-2.208 0.192-2.816-0.544c-0.608-0.704-0.192-1.984-0.192-1.984zm10.912 0.192s0.32 1.28-0.64 2.048c-0.672 0.544-2.336 0.256-2.336 0.256s-0.224-1.408 0.704-2.144c0.896-0.704 2.24-0.192 2.24-0.192zm-1.472 11.424s1.504 0.448 1.248 1.44c-0.224 0.896-1.472 1.76-2.368 1.536-0.576-0.16-0.416-0.704-0.192-1.248s0.8 0.032 1.12-0.448c0.352-0.512 0.192-1.248 0.192-1.248zm-8.288-0.288s0 1.024 0.352 1.536c0.32 0.48 0.96 0 1.184 0.544s0.32 1.088-0.256 1.248c-0.896 0.256-2.112-0.608-2.336-1.536-0.224-0.96 1.056-1.824 1.056-1.824z"
            fill="#222"
          />
        </svg>
        <div ref={$.ref.vu} class="vu"></div>
      </div>
    ))

    $.effect(({ peakVolume, vu, gradientCanvasCtx: ctx }) => {
      const pos = Math.min(1, (peakVolume ** 1.25) * 2)
      const x = Math.max(0, Math.min(99, $.clipping ? 99 : pos * 99))
      if (!Number.isFinite(x)) return
      const { data } = ctx.getImageData(x, 0, 1, 1)
      const color = `rgba(${data.subarray(0, 3)},${pos ** 1.5})`
      vu.style.setProperty('--color', color)
    })

    $.PlayPauseStop = $.part(({ playOrPause, stop }) => (
      <div class="play-pause-stop">
        <button class="play-pause" onpointerdown={playOrPause}>
          <IconSvg set="tabler" icon="player-play" />
          <IconSvg set="tabler" icon="player-pause" />
        </button>
        <button onpointerdown={stop}>
          <IconSvg set="tabler" icon="player-stop" />
        </button>
      </div>
    ))

    let animFrame: any
    $.effect(({ audioContext, analyserNode, analyserBuffer, state, bar, beat, sixt }) =>
      $.chain(
        $.on(state).playingstart(() => {
          cancelAnimationFrame(animFrame)
          const tick = $.atomic(() => {
            animFrame = requestAnimationFrame(tick)

            const co = (60 * 4) / $.bpm
            const b = (audioContext.currentTime - $.startTime) / co

            bar.textContent = '' + Math.max(1, Math.floor(b % 16) + 1)
            beat.textContent = '' + Math.max(1, Math.floor((b * 4) % 4) + 1)
            sixt.textContent = '' + Math.max(1, Math.floor((b * 16) % 16) + 1)

            analyserNode.getFloatTimeDomainData(analyserBuffer)
            const length = analyserBuffer.length

            const now = performance.now()

            let sum = 0.0
            let x = 0.0

            // Do a root-mean-square on the samples: sum up the squares...
            for (let i = 0; i < length; i++) {
              x = Math.abs(analyserBuffer[i])
              if (x >= $.clipThreshold) {
                $.clipping = true
                $.lastClip = now
              }
              sum += x * x
            }

            // ... then take the square root of the sum.
            const rms = Math.sqrt(sum / length)

            // Now smooth this out with the averaging factor applied
            // to the previous sample - take the max here because we
            // want "fast attack, slow release."
            $.peakVolume = Math.max(rms, $.peakVolume * 0.97)

            $.peak = Math.max($.peak, $.peakVolume)

            // this.volumeDb = linearToDb(this.volume)
            // this.peakDb = linearToDb(this.peak)

            if (now - $.lastPeak > $.peakLag) {
              $.peak = $.peakVolume
              $.lastPeak = now
            }
            if ($.clipping) {
              if (now - $.lastClip > $.clipLag) {
                $.clipping = false
              }
            }
          })
          animFrame = requestAnimationFrame(tick)
        }),
        $.on(state).playingcancel(() => {
          cancelAnimationFrame(animFrame)
        }),
        $.on(state).playingpause(() => {
          cancelAnimationFrame(animFrame)
        }),
        $.on(state).playingend(() => {
          cancelAnimationFrame(animFrame)
        })
      )
    )

    $.Time = $.part(({ Bpm }) => (
      <div class="time">
        <Bpm />
        <span ref={$.ref.bar}>1</span>
        <span class="separator">.</span>
        <span ref={$.ref.beat}>1</span>
        <span class="separator">.</span>
        <span ref={$.ref.sixt}>1</span>
      </div>
    ))

    $.effect(({ schedulerNode, bpm }) => {
      schedulerNode.setBpm(bpm)
    })

    $.Bpm = $.part(({ NumberInput, bpm }) => (
      <NumberInput
        value={bpm}
        onchange={function(this: NumberInputElement) {
          $.bpm = this.value
        }}
        min={1}
        max={999}
        step={1}
      />
    ))

    $.render(({ NumberInput, PlayPauseStop, Time, Logo }) => (
      <>
        <style>
          {$.css /*css*/`
          :host {
            contain: size layout style paint;
            width: 600px;
            height: 100%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex-flow: row nowrap;
            gap: 10px;
            overflow: hidden;

            > div {
              flex-flow: row nowrap;
              display: flex;
              /* width: 120px; */
            }

            .play-pause-stop {
              width: 60px;
              min-width: 60px;
            }

            .logo {
              position: relative;
              z-index: -1;
              width: 120px;
              min-width: 120px;
              margin: 0px;
              margin-top: 5px;

              .vu {
                --color: #676;
                position: absolute;
                background-color: var(--color);
                width: 42px;
                height: 20px;
                top: 48px;
                left: 40px;
                z-index: -1;
              }
            }

            button {
              cursor: pointer;
              height: 100%;
              width: auto;
              padding: 0;

              background: transparent;
              color: #444;
              border: none;

              &.selected,
              &:hover {
                background: #fff2;
                color: #888;
              }

              ${IconSvg} {
                height: 100%;
                &::part(svg) {
                  stroke-width: 1.25px;
                  stroke: transparent;
                  fill: currentColor;
                }
              }
            }

            .time, .play-pause-stop {
              height: 100%;
            }

            ${NumberInput} {
              font-family: monospace;
              height: 100%;
              width: 3.85em;
              margin-right: 1.5em;
            }

            .time {
              width: 200px;
              contain: size layout style paint;
              font-family: monospace;
              display: inline-flex;
              flex-flow: row nowrap;
              align-items: center;
              justify-content: flex-end;
              height: 100%;

              span {
                display: inline-flex;
                text-align: center;
                width: 1.5em;
                overflow: hidden;
              }
            }
          }

          :host([state=${AudioTransportState.Playing}]) {
            .play-pause {
              &:not(:hover) {
                [icon=player-pause] {
                  display: none;
                }
              }
              &:hover {
                [icon=player-play] {
                  display: none;
                }
              }
            }
            button {
              ${IconSvg} {
                &[icon=player-pause],
                &[icon=player-play] {
                  &::part(svg) {
                    fill: #5af273;
                  }
                }
              }
            }
          }
          :host(:not([state=${AudioTransportState.Playing}])) {
            .vu {
              transition: opacity 2.5s ease-in;
              opacity: 0;
            }
          }

          :host(:not([state=${AudioTransportState.Playing}]):not([state=${AudioTransportState.Paused}])) {
            [icon=player-pause] {
              display: none;
            }
          }
          :host([state=${AudioTransportState.Paused}]) {
            .play-pause {
              &:not(:hover) {
                [icon=player-play] {
                  display: none;
                }
              }
              &:hover {
                [icon=player-pause] {
                  display: none;
                }
              }
            }
          }
          `('')}
        </style>
        <Time />
        <Logo />
        <PlayPauseStop />
      </>
    ))
  }
}
