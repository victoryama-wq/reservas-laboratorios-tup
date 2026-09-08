import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AdminSpecialRuleDialogComponent } from './admin-special-rule-dialog.component';

describe('Reglas: guardado y conservación del formulario', () => {
  async function render(mode: 'create' | 'edit' = 'create', save = vi.fn(async () => 'rule-1')) {
    const ref = { close: vi.fn(), disableClose: false };
    await TestBed.configureTestingModule({ imports: [AdminSpecialRuleDialogComponent],
      providers: [ { provide: MatDialogRef, useValue: ref },
        { provide: MAT_DIALOG_DATA, useValue: { mode, save, labs: [], selectedLabId: 'lab-1',
          rule: mode === 'edit' ? { id: 'rule-1', labId: 'lab-1', name: 'Regla', reason: 'Interno' } : undefined } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AdminSpecialRuleDialogComponent);
    await fixture.whenStable();
    fixture.componentInstance['form'].patchValue({ name: 'Regla', reason: 'Interno' });
    return { fixture, component: fixture.componentInstance, ref, save };
  }

  it('envía todos los días como [] y opcionales vacíos como null', async () => {
    const { component, save, ref } = await render();
    component['form'].patchValue({ fullDayBlocked: true });
    await component['save']();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({daysOfWeek: [],
      termStart: null, termEnd: null, blockedStart: null, blockedEnd: null}));
    expect(ref.close).toHaveBeenCalledOnce();
  });

  it('conserva datos, muestra error y permite reintentar sin cerrar', async () => {
    const save = vi.fn(async () => { throw new Error('network failure'); });
    const { component, fixture, ref } = await render('edit', save);
    expect(component['form'].get('labId')?.disabled).toBe(true);
    await component['save']();
    await fixture.whenStable();
    expect(ref.close).not.toHaveBeenCalled();
    expect(component['form'].getRawValue().name).toBe('Regla');
    expect(component['form'].get('labId')?.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Los datos se conservaron');
    expect(ref.disableClose).toBe(false);
  });

  it('impide doble envío y no cierra mientras espera al servidor', async () => {
    let finish!: (value: string) => void;
    const save = vi.fn(() => new Promise<string>((resolve) => { finish = resolve; }));
    const { component, ref } = await render('create', save);
    const pending = component['save']();
    await component['save']();
    component['close']();
    expect(ref.close).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledOnce();
    expect(component['form'].disabled).toBe(true);
    finish('rule-1');
    await pending;
    expect(ref.close).toHaveBeenCalledOnce();
  });
});
