import { Component, ElementRef, HostListener, Input, ViewChild, inject, output, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Contract, NoveltySummary } from '../../../domain/models/contract.entity';
import { ContractAction } from '../../../domain/models/contract-status.enum';
import {
  availableActions,
  canManageContract,
  currentContractValue,
  effectiveStatus,
  hasNoveltyInProgress
} from '../../../domain/contract.rules';
import { UserSessionService } from '../../../../../shared/auth/user-session.service';
import { formatDocument } from '../../../../../shared/util/format.util';

interface NoveltyMenuOption {
  action: ContractAction;
  label: string;
  icon: string;
  /** Segmento de ruta de la vista de creación correspondiente; null para acciones sin vista propia. */
  path: string | null;
}

/** Catálogo de opciones de menú por acción de dominio. */
const MENU_OPTIONS: Record<ContractAction, NoveltyMenuOption> = {
  [ContractAction.ADICION_PRORROGA]: { action: ContractAction.ADICION_PRORROGA, label: 'Adición y Prórroga', icon: 'add_circle', path: 'adicion-prorroga' },
  [ContractAction.SUSPENSION]: { action: ContractAction.SUSPENSION, label: 'Suspensión', icon: 'pause_circle', path: 'suspension' },
  [ContractAction.CESION]: { action: ContractAction.CESION, label: 'Cesión', icon: 'swap_horiz', path: 'cesion' },
  [ContractAction.TERMINACION]: { action: ContractAction.TERMINACION, label: 'Terminación Anticipada', icon: 'cancel', path: 'terminacion' },
  [ContractAction.REINICIO]: { action: ContractAction.REINICIO, label: 'Reinicio', icon: 'play_circle', path: 'reinicio' },
  [ContractAction.AGREGAR_POLIZA]: { action: ContractAction.AGREGAR_POLIZA, label: 'Agregar Póliza', icon: 'verified_user', path: 'poliza' },
  [ContractAction.ACTIVAR_CONTRATO]: { action: ContractAction.ACTIVAR_CONTRATO, label: 'Activar Contrato', icon: 'restart_alt', path: null }
};

/**
 * Fila expandible del listado de contratos: encabezado con los datos clave,
 * detalle con el historial de novedades y menú de acciones.
 *
 * Las acciones ofrecidas salen del mapa estado → acciones del dominio
 * (`availableActions`), y se ocultan por completo cuando la regla de rol
 * (SUPERVISOR con documento distinto) deja al usuario en solo consulta.
 */
@Component({
  selector: 'app-contract-accordion',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, MatIconModule],
  templateUrl: './contract-accordion.component.html'
})
export class ContractAccordionComponent {
  @Input({ required: true }) contract!: Contract;

  private readonly userSession = inject(UserSessionService);

  /** Solicitud de anulación de una novedad. */
  readonly annul = output<NoveltySummary>();
  /** Solicitud de activación (reapertura) de un contrato Finalizado. */
  readonly activate = output<void>();

  @ViewChild('menuRef') private menuRef?: ElementRef<HTMLElement>;

  readonly isMenuOpen = signal(false);

  /** Año de vigencia (VigenciaContrato), tomado del id compuesto `${numero}_${vigencia}`. */
  get vigencia(): string {
    return this.contract.id?.split('_').pop() ?? '';
  }

  /** NIT/CC con puntos de separación visuales. */
  get contractorDocument(): string {
    return formatDocument(this.contract.contractorId);
  }

  /** Estado efectivo mostrado en el detalle (real del backend o inferido). */
  get estado(): string {
    return effectiveStatus(this.contract);
  }

  /** Valor vigente: base + adiciones históricas (puede diferir del valor inicial). */
  get valorVigente(): number {
    return currentContractValue(this.contract);
  }

  /** Solo consulta: regla de rol SUPERVISOR con documento distinto al del contrato. */
  get readOnly(): boolean {
    const session = this.userSession.session();
    return !canManageContract(session.roles, session.documento, this.contract);
  }

  /** Una novedad "En trámite" bloquea cualquier acción nueva sobre el contrato. */
  get bloqueadoPorTramite(): boolean {
    return hasNoveltyInProgress(this.contract);
  }

  /** Acciones habilitadas por el estado del contrato, ya resueltas a opciones de menú. */
  get noveltyMenuOptions(): NoveltyMenuOption[] {
    return availableActions(this.contract).map(action => MENU_OPTIONS[action]);
  }

  /** El botón "Añadir Novedad" solo aparece si hay acciones y el usuario puede gestionar. */
  get showActions(): boolean {
    return !this.readOnly && this.noveltyMenuOptions.length > 0;
  }

  onActivate(): void {
    this.closeMenu();
    this.activate.emit();
  }

  toggleMenu(): void {
    this.isMenuOpen.update(open => !open);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isMenuOpen() && !this.menuRef?.nativeElement.contains(event.target as Node)) {
      this.isMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isMenuOpen.set(false);
  }
}
