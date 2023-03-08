import {
  AdminReservationsListRes,
  Order,
  ReservationItemDTO,
} from "@medusajs/medusa"
import { DisplayTotal, PaymentDetails } from "../templates"
import React, { useContext, useMemo } from "react"

import { ActionType } from "../../../../components/molecules/actionables"
import AllocateItemsModal from "../allocations/allocate-items-modal"
import Badge from "../../../../components/fundamentals/badge"
import BodyCard from "../../../../components/organisms/body-card"
import CopyToClipboard from "../../../../components/atoms/copy-to-clipboard"
import { OrderEditContext } from "../../edit/context"
import OrderLine from "../order-line"
import { Response } from "@medusajs/medusa-js"
import StatusIndicator from "../../../../components/fundamentals/status-indicator"
import { sum } from "lodash"
import { useAdminReservations } from "medusa-react"
import { useFeatureFlag } from "../../../../providers/feature-flag-provider"
import useToggleState from "../../../../hooks/use-toggle-state"

type SummaryCardProps = {
  order: Order
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  order,
}: {
  order: Order
}) => {
  const {
    state: allocationModalIsOpen,
    open: showAllocationModal,
    close: closeAllocationModal,
  } = useToggleState()

  const { showModal } = useContext(OrderEditContext)
  const { isFeatureEnabled } = useFeatureFlag()
  const inventoryEnabled = isFeatureEnabled("inventoryService")

  const { reservations, isLoading, refetch } = useAdminReservations(
    {
      line_item_id: order.items.map((item) => item.id),
    },
    {
      enabled: inventoryEnabled,
      initialData: {
        reservations: [] as ReservationItemDTO[],
        limit: 0,
        offset: 0,
        count: 0,
      } as Response<AdminReservationsListRes>,
    }
  )

  React.useEffect(() => {
    if (inventoryEnabled) {
      refetch()
    }
  }, [inventoryEnabled, refetch])

  const reservationItemsMap = useMemo(() => {
    if (!reservations?.length || !inventoryEnabled || isLoading) {
      return {}
    }

    return reservations.reduce(
      (acc: Record<string, ReservationItemDTO[]>, item: ReservationItemDTO) => {
        if (!item.line_item_id) {
          return acc
        }
        acc[item.line_item_id] = acc[item.line_item_id]
          ? [...acc[item.line_item_id], item]
          : [item]
        return acc
      },
      {}
    )
  }, [reservations, inventoryEnabled, isLoading])

  const allItemsReserved = useMemo(() => {
    return order.items.every((item) => {
      const reservations = reservationItemsMap[item.id]
      if (!reservations) {
        return false
      }
      return sum(reservations.map((r) => r.quantity)) === item.quantity
    })
  }, [reservationItemsMap, order])

  const { hasMovements, swapAmount, manualRefund, swapRefund, returnRefund } =
    useMemo(() => {
      let manualRefund = 0
      let swapRefund = 0
      let returnRefund = 0

      const swapAmount = sum(order?.swaps.map((s) => s.difference_due) || [0])

      if (order?.refunds?.length) {
        order.refunds.forEach((ref) => {
          if (ref.reason === "other" || ref.reason === "discount") {
            manualRefund += ref.amount
          }
          if (ref.reason === "return") {
            returnRefund += ref.amount
          }
          if (ref.reason === "swap") {
            swapRefund += ref.amount
          }
        })
      }
      return {
        hasMovements:
          swapAmount + manualRefund + swapRefund + returnRefund !== 0,
        swapAmount,
        manualRefund,
        swapRefund,
        returnRefund,
      }
    }, [order])

  const actionables = useMemo(() => {
    const actionables: ActionType[] = []
    if (isFeatureEnabled("order_editing")) {
      actionables.push({
        label: "Edit Order",
        onClick: showModal,
      })
    }
    if (isFeatureEnabled("inventoryService")) {
      actionables.push({
        label: "Allocate",
        onClick: showAllocationModal,
      })
    }
    return actionables
  }, [showModal, isFeatureEnabled, showAllocationModal])

  return (
    <BodyCard
      className={"mb-4 h-auto min-h-0 w-full"}
      title="Summary"
      status={
        isFeatureEnabled("inventoryService") && (
          <StatusIndicator
            variant={allItemsReserved ? "success" : "danger"}
            title={allItemsReserved ? "Allocated" : "Awaits allocation"}
            className="rounded-rounded border px-3 py-1.5"
          />
        )
      }
      actionables={actionables}
    >
      <div className="mt-6">
        {order.items?.map((item, i) => (
          <OrderLine
            key={i}
            item={item}
            currencyCode={order.currency_code}
            reservations={reservationItemsMap[item.id]}
          />
        ))}
        <DisplayTotal
          currency={order.currency_code}
          totalAmount={order.subtotal}
          totalTitle={"Subtotal"}
        />
        {order?.discounts?.map((discount, index) => (
          <DisplayTotal
            key={index}
            currency={order.currency_code}
            totalAmount={-1 * order.discount_total}
            totalTitle={
              <div className="inter-small-regular text-grey-90 flex items-center">
                Discount:{" "}
                <Badge className="ml-3" variant="default">
                  {discount.code}
                </Badge>
              </div>
            }
          />
        ))}
        {order?.gift_cards?.map((giftCard, index) => (
          <DisplayTotal
            key={index}
            currency={order.currency_code}
            totalAmount={-1 * order.gift_card_total}
            totalTitle={
              <div className="inter-small-regular text-grey-90 flex items-center">
                Gift card:
                <Badge className="ml-3" variant="default">
                  {giftCard.code}
                </Badge>
                <div className="ml-2">
                  <CopyToClipboard
                    value={giftCard.code}
                    showValue={false}
                    iconSize={16}
                  />
                </div>
              </div>
            }
          />
        ))}
        <DisplayTotal
          currency={order.currency_code}
          totalAmount={order.shipping_total}
          totalTitle={"Shipping"}
        />
        <DisplayTotal
          currency={order.currency_code}
          totalAmount={order.tax_total}
          totalTitle={`Tax`}
        />
        <DisplayTotal
          variant={"large"}
          currency={order.currency_code}
          totalAmount={order.total}
          totalTitle={hasMovements ? "Original Total" : "Total"}
        />
        <PaymentDetails
          manualRefund={manualRefund}
          swapAmount={swapAmount}
          swapRefund={swapRefund}
          returnRefund={returnRefund}
          paidTotal={order.paid_total}
          refundedTotal={order.refunded_total}
          currency={order.currency_code}
        />
      </div>
      {allocationModalIsOpen && (
        <AllocateItemsModal
          reservationItemsMap={reservationItemsMap}
          order={order}
          close={closeAllocationModal}
        />
      )}
    </BodyCard>
  )
}

export default SummaryCard
