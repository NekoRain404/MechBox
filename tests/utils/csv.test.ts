import { describe, expect, it } from 'vitest'
import { parseCsvText, stringifyCsv } from '../../src/shared/csv'

describe('shared csv utilities', () => {
  it('parses quoted values and escaped quotes', () => {
    const csv = 'designation,applications\nQ235B,"一般结构,""焊接结构"""\n'
    const parsed = parseCsvText(csv)

    expect(parsed.headers).toEqual(['designation', 'applications'])
    expect(parsed.rows).toEqual([
      {
        designation: 'Q235B',
        applications: '一般结构,"焊接结构"',
      },
    ])
  })

  it('parses bom and crlf line endings', () => {
    const csv = '\uFEFFdesignation,d,width\r\n6205,25,15\r\n'
    const parsed = parseCsvText(csv)

    expect(parsed.headers).toEqual(['designation', 'd', 'width'])
    expect(parsed.rows[0]).toEqual({
      designation: '6205',
      d: '25',
      width: '15',
    })
  })

  it('stringifies rows with comma and quotes', () => {
    const csv = stringifyCsv([
      {
        designation: 'Q235B',
        applications: '一般结构,"焊接结构"',
      },
    ])

    expect(csv).toBe('designation,applications\nQ235B,"一般结构,""焊接结构"""\n')
  })
})
