import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AdminBlockedPeriodDialogComponent } from './admin-blocked-period-dialog.component';

describe('Bloqueos extraordinarios en Cancún', () => {
  it('incluye el último día completo y convierte horas civiles a UTC', async () => {
    const save = vi.fn(async () => 'block-1');
    await TestBed.configureTestingModule({ imports: [AdminBlockedPeriodDialogComponent], providers: [
      { provide: MatDialogRef, useValue: {close: vi.fn()} },
      { provide: MAT_DIALOG_DATA, useValue: {mode: 'create', labs: [], save} },
    ]}).compileComponents();
    const fixture = TestBed.createComponent(AdminBlockedPeriodDialogComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component['form'].patchValue({name: 'Bloqueo', reason: 'Interno', fullDay: true,
      startAt: '2026-09-08', endAt: '2026-09-08'});
    expect(component['form'].valid).toBe(true);
    await component['save']();
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({
      startAt: '2026-09-08T05:00:00.000Z', endAt: '2026-09-09T05:00:00.000Z',
    }));
    component['form'].patchValue({fullDay: false,
      startAt: '2026-09-08T08:00', endAt: '2026-09-08T13:00'});
    await component['save']();
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({
      startAt: '2026-09-08T13:00:00.000Z', endAt: '2026-09-08T18:00:00.000Z',
    }));
  });
});
